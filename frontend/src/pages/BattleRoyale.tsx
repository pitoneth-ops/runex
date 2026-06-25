import { useState, useEffect, useCallback, useRef } from "react";
import { useGameStore } from "../store";
import { getPlayer, battleRoyale } from "../api";
import { payRunex } from "../solana";
import type { HeroX, BRFight, BRResult } from "../api";
import { OsrsSprite } from "../components/OsrsSprite";
import { HERO_SPRITES, RUNEX_ICON } from "../sprites";

// ── Constants ──────────────────────────────────────────────────────────────────
const CLASS_ICON:  Record<string, string> = { berserker: "⚔️", ranger: "🏹", sorcerer: "🔮", paladin: "🛡️" };
const CLASS_LABEL: Record<string, string> = { berserker: "Berserker", ranger: "Ranger", sorcerer: "Sorcerer", paladin: "Paladin" };
const RARITY_COLOR: Record<string, string> = { common: "#9ca3af", rare: "#60a5fa", epic: "#c084fc", legendary: "#fbbf24" };
const RARITY_GLOW:  Record<string, string> = {
  common: "rgba(156,163,175,0.15)", rare: "rgba(96,165,250,0.2)",
  epic: "rgba(192,132,252,0.25)",   legendary: "rgba(251,191,36,0.3)",
};

const ENTRY_COST   = 100_000;
const LEVEL_NEEDED = 10;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ── Sub-components ─────────────────────────────────────────────────────────────

function HpBar({ pct, flipped }: { pct: number; flipped?: boolean }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color   = clamped > 50 ? "#4ade80" : clamped > 25 ? "#facc15" : "#ef4444";
  return (
    <div className="rounded-full overflow-hidden" style={{ height: 7, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(0,0,0,0.6)", direction: flipped ? "rtl" : "ltr" }}>
      <div style={{ width: `${clamped}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.5s ease-out, background 0.3s", boxShadow: `0 0 8px ${color}88` }} />
    </div>
  );
}

function FighterCard({ srcs, fallback, name, rarity, subtitle, hpPct, side, shaking, dead }: {
  srcs: string[]; fallback: string; name: string; rarity: string; subtitle: string;
  hpPct: number; side: "left" | "right"; shaking: boolean; dead: boolean;
}) {
  const glow   = RARITY_GLOW[rarity]  ?? "rgba(255,255,255,0.1)";
  const rCol   = RARITY_COLOR[rarity] ?? "#a08040";
  const isLeft = side === "left";
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      {/* Name + rarity (top of card on opponent side, reversed on hero side) */}
      {!isLeft && (
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.62rem", fontWeight: 700, color: rCol, fontFamily: "'Cinzel',serif", lineHeight: 1.2 }}>{name}</p>
          <p style={{ fontSize: "0.52rem", color: "#6b4f10" }}>{subtitle}</p>
        </div>
      )}

      {/* Sprite box */}
      <div style={{
        width: "100%", height: 96,
        borderRadius: 14,
        background: `radial-gradient(ellipse at center, ${glow} 0%, rgba(5,2,0,0.8) 75%)`,
        border: `1.5px solid ${dead ? "rgba(239,68,68,0.3)" : rCol + "55"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", position: "relative",
        transform: shaking ? (isLeft ? "translateX(-5px)" : "translateX(5px)") : "none",
        transition: "transform 0.08s",
        opacity: dead ? 0.35 : 1,
        filter: dead ? "grayscale(0.8)" : "none",
      }}>
        <div style={{ transform: isLeft ? "none" : "scaleX(-1)" }}>
          <OsrsSprite srcs={srcs} fallback={fallback} size={86} pixelated={false} />
        </div>
        {dead && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "1.6rem" }}>💀</span>
          </div>
        )}
      </div>

      {/* HP bar */}
      <div style={{ width: "100%", paddingInline: 2 }}>
        <HpBar pct={hpPct} flipped={!isLeft} />
      </div>

      {/* Name on hero side */}
      {isLeft && (
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.62rem", fontWeight: 700, color: rCol, fontFamily: "'Cinzel',serif", lineHeight: 1.2 }}>{name}</p>
          <p style={{ fontSize: "0.52rem", color: "#6b4f10" }}>{subtitle}</p>
        </div>
      )}
    </div>
  );
}

// ── Hero Selector ──────────────────────────────────────────────────────────────
function HeroPickCard({ hero, selected, onClick }: { hero: HeroX; selected: boolean; onClick: () => void }) {
  const srcs  = HERO_SPRITES[hero.hero_class]?.[hero.rarity] ?? [];
  const level = hero.hero_level ?? 0;
  const qual  = level >= LEVEL_NEEDED;
  const rCol  = RARITY_COLOR[hero.rarity];
  return (
    <button onClick={onClick} disabled={!qual} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
      borderRadius: 12, width: "100%", textAlign: "left", cursor: qual ? "pointer" : "not-allowed",
      background: selected ? `${rCol}18` : "rgba(0,0,0,0.3)",
      border: `1.5px solid ${selected ? rCol : qual ? "#3d2a00" : "#1a1200"}`,
      opacity: qual ? 1 : 0.45, transition: "all 0.15s",
    }}>
      <div style={{ width: 46, height: 54, flexShrink: 0, borderRadius: 8, overflow: "hidden", background: "rgba(0,0,0,0.4)", border: `1px solid ${rCol}40` }}>
        <OsrsSprite srcs={srcs} fallback={CLASS_ICON[hero.hero_class]} size={50} pixelated={false} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: "'Cinzel',serif", fontWeight: 900, color: "#e8d9a0", fontSize: "0.82rem" }}>
          {CLASS_LABEL[hero.hero_class]}
        </p>
        <p style={{ fontSize: "0.62rem", color: rCol, marginTop: 1 }}>{hero.rarity_emoji} {hero.rarity}</p>
        {!qual && <p style={{ fontSize: "0.55rem", color: "#ef4444", marginTop: 2 }}>Needs Lv.{LEVEL_NEEDED} · has {(hero.total_runex_earned / 1000).toFixed(1)}k RuneX</p>}
      </div>
      <div style={{
        padding: "3px 9px", borderRadius: 20, fontSize: "0.65rem", fontWeight: 700,
        background: qual ? `${rCol}22` : "rgba(0,0,0,0.3)",
        border: `1px solid ${qual ? rCol : "#3d2a00"}`,
        color: qual ? rCol : "#6b4f10",
        flexShrink: 0,
      }}>Lv.{level}</div>
    </button>
  );
}

// ── Fight progress track ───────────────────────────────────────────────────────
function FightTrack({ result, currentFight }: { result: BRResult | null; currentFight: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "center" }}>
      {Array.from({ length: 7 }).map((_, i) => {
        const fight    = result?.fights[i];
        const isCur    = !result && i === currentFight - 1;
        const won      = fight?.won === true;
        const lost     = fight?.won === false;
        const active   = isCur || (result && i === currentFight - 1);
        const diff     = i < 2 ? "#9ca3af" : i < 4 ? "#60a5fa" : i < 6 ? "#c084fc" : "#fbbf24";
        return (
          <div key={i} style={{
            width: active ? 28 : 20, height: 20, borderRadius: 5, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.55rem", fontWeight: 700,
            background: won ? "rgba(74,222,128,0.2)" : lost ? "rgba(239,68,68,0.2)" : active ? `${diff}22` : "rgba(0,0,0,0.4)",
            border: `1px solid ${won ? "#4ade80" : lost ? "#ef4444" : active ? diff : "#2a1a00"}`,
            color: won ? "#4ade80" : lost ? "#ef4444" : active ? diff : "#3d2a00",
            transition: "all 0.3s",
            boxShadow: active ? `0 0 8px ${diff}44` : "none",
          }}>
            {won ? "✓" : lost ? "✗" : active ? "⚔" : String(i + 1)}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
type PageState = "lobby" | "fighting" | "done";

export default function BattleRoyale() {
  const { wallet, player, setPlayer } = useGameStore();
  const [loading,    setLoading]    = useState(false);
  const [pageState,  setPageState]  = useState<PageState>("lobby");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [result,     setResult]     = useState<BRResult | null>(null);

  // Fight animation state
  const [curFight,      setCurFight]      = useState<BRFight | null>(null);
  const [curFightNum,   setCurFightNum]   = useState(0);
  const [narrativeLines,setNarrativeLines] = useState<string[]>([]);
  const [heroHpPct,     setHeroHpPct]     = useState(100);
  const [oppHpPct,      setOppHpPct]      = useState(100);
  const [heroShaking,   setHeroShaking]   = useState(false);
  const [oppShaking,    setOppShaking]    = useState(false);
  const [fightPhase,    setFightPhase]    = useState<"intro"|"battle"|"result">("intro");
  const logRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try { const p = await getPlayer(wallet); setPlayer(p); }
    finally { setLoading(false); }
  }, [wallet, setPlayer]);

  useEffect(() => { refresh(); }, [refresh]);

  const heroes     = player?.heroes ?? [];
  const qualifying = heroes.filter(h => (h.hero_level ?? 0) >= LEVEL_NEEDED);

  useEffect(() => {
    if (!selectedId && qualifying.length > 0) setSelectedId(qualifying[0].id);
  }, [qualifying.length]);

  const selectedHero = heroes.find(h => h.id === selectedId) ?? null;
  const canAfford    = (player?.runex ?? 0) >= ENTRY_COST;
  const heroQual     = (selectedHero?.hero_level ?? 0) >= LEVEL_NEEDED;

  if (!wallet) return <p className="text-center text-gray-500 py-20">Connect wallet first.</p>;

  async function handleEnter() {
    if (!wallet || !selectedHero) return;
    setLoading(true);
    setNarrativeLines([]);
    setHeroHpPct(100);
    setOppHpPct(100);

    try {
      const txSig = await payRunex(ENTRY_COST);
      const res = await battleRoyale(wallet, selectedHero.id, txSig);
      setResult(res);
      await getPlayer(wallet).then(p => setPlayer(p));
      setLoading(false);
      setPageState("fighting");
      await runAnimation(res, selectedHero);
      setPageState("done");
    } catch (e: any) {
      setLoading(false);
      const msg = e?.message ?? e?.response?.data?.detail ?? "Error";
      alert(msg.includes("rejected") ? "Transaction cancelled." : msg);
    }
  }

  async function runAnimation(res: BRResult, hero: HeroX) {
    const heroMaxHp = hero.stats.hp;
    let fightsDone  = 0;

    for (const fight of res.fights) {
      setCurFight(fight);
      setCurFightNum(fight.fight_number);
      setNarrativeLines([]);
      setHeroHpPct(100);
      setOppHpPct(100);
      setHeroShaking(false);
      setOppShaking(false);
      setFightPhase("intro");
      await sleep(650);

      setFightPhase("battle");
      const lines = fight.lines;

      for (let i = 0; i < lines.length; i++) {
        const line     = lines[i];
        const progress = (i + 1) / Math.max(lines.length - 1, 1);
        const isHeroAtk = line.startsWith("Your ") || line.startsWith("✅");
        const isOppAtk  = !isHeroAtk && !line.startsWith("✅") && !line.startsWith("💀");

        // Animate HP
        if (fight.won) {
          setOppHpPct(Math.max(0, 100 - progress * 100));
          setHeroHpPct(Math.max(5, (fight.hp_left / heroMaxHp) * 100 + (1 - progress) * (100 - (fight.hp_left / heroMaxHp) * 100)));
        } else {
          setOppHpPct(Math.max(20, 100 - progress * 45));
          setHeroHpPct(Math.max(0, 100 - progress * 100));
        }

        // Shake
        if (isHeroAtk)  { setOppShaking(true);  await sleep(60); setOppShaking(false); }
        if (isOppAtk)   { setHeroShaking(true);  await sleep(60); setHeroShaking(false); }

        setNarrativeLines(prev => {
          const next = [...prev, line];
          setTimeout(() => logRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 15);
          return next;
        });
        await sleep(170);
      }

      // Snap HP to final
      setOppHpPct(fight.won ? 0 : 35);
      setHeroHpPct(fight.won ? Math.max(0, (fight.hp_left / heroMaxHp) * 100) : 0);
      setFightPhase("result");
      fightsDone++;
      await sleep(fight.won ? 900 : 1500);
      if (!fight.won) break;
    }
  }

  // ── LOBBY ────────────────────────────────────────────────────────────────────
  if (pageState === "lobby") {
    return (
      <div className="animate-fade-in" style={{ paddingBottom: 20 }}>

        {/* Hero banner */}
        <div style={{
          borderRadius: 16, overflow: "hidden", marginBottom: 20,
          background: "linear-gradient(160deg,rgba(100,0,0,0.35) 0%,rgba(5,2,0,1) 100%)",
          border: "1px solid rgba(139,0,0,0.4)",
        }}>
          <div style={{ padding: "20px 18px" }}>
            <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "1.5rem", fontWeight: 900, letterSpacing: "0.06em", textShadow: "0 0 24px rgba(255,204,0,0.35)" }}>
              ⚔ BATTLE ROYALE
            </p>
            <p style={{ color: "#a08040", fontSize: "0.72rem", marginTop: 4 }}>
              Seven opponents. One champion. No respawns.
            </p>
            {/* Prize */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "8px 12px", borderRadius: 10, background: "rgba(255,96,96,0.08)", border: "1px solid rgba(255,96,96,0.2)" }}>
              <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={22} />
              <div>
                <p style={{ fontSize: "0.6rem", color: "#a08040" }}>GRAND PRIZE</p>
                <p style={{ fontFamily: "'Cinzel',serif", color: "#ff6060", fontWeight: 900, fontSize: "1rem" }}>1,000,000 RuneX</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rules grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
          {[
            { icon: "⚔", title: "7 Fights", sub: "Sequential — one life only" },
            { icon: "📈", title: "Scaling AI", sub: "Common → Legendary" },
            { icon: "💎", title: "100k RuneX", sub: "Entry fee, non-refundable" },
            { icon: "📊", title: "Hero Lv.10", sub: "Earn 100k RuneX in battles" },
          ].map(r => (
            <div key={r.title} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.35)", border: "1px solid #2a1a00" }}>
              <span style={{ fontSize: "1.1rem" }}>{r.icon}</span>
              <p style={{ fontFamily: "'Cinzel',serif", color: "#e8d9a0", fontSize: "0.7rem", fontWeight: 700, marginTop: 4 }}>{r.title}</p>
              <p style={{ color: "#6b4f10", fontSize: "0.6rem", marginTop: 2 }}>{r.sub}</p>
            </div>
          ))}
        </div>

        {/* Difficulty track */}
        <div style={{ marginBottom: 18 }}>
          <p style={{ fontFamily: "'Cinzel',serif", color: "#a08040", fontSize: "0.65rem", fontWeight: 700, marginBottom: 8, letterSpacing: "0.08em" }}>DIFFICULTY PROGRESSION</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { fights: "Fights 1–2", tier: "Common",    col: "#9ca3af" },
              { fights: "Fights 3–4", tier: "Rare",      col: "#60a5fa" },
              { fights: "Fights 5–6", tier: "Epic",      col: "#c084fc" },
              { fights: "Fight 7",    tier: "Legendary ★", col: "#fbbf24" },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: `1px solid ${row.col}22` }}>
                <div style={{ width: 3, height: 24, borderRadius: 2, background: row.col, flexShrink: 0 }} />
                <span style={{ fontSize: "0.65rem", color: "#6b4f10", flex: 1 }}>{row.fights}</span>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: row.col }}>{row.tier}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hero selector */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontFamily: "'Cinzel',serif", color: "#a08040", fontSize: "0.65rem", fontWeight: 700, marginBottom: 8, letterSpacing: "0.08em" }}>SELECT HERO</p>
          {heroes.length === 0 ? (
            <div style={{ padding: "24px", borderRadius: 12, border: "2px dashed #2a1a00", textAlign: "center" }}>
              <p style={{ color: "#6b4f10", fontSize: "0.75rem", fontFamily: "'Cinzel',serif" }}>No heroes found</p>
              <p style={{ color: "#3d2a00", fontSize: "0.6rem", marginTop: 4 }}>Mint a HeroX in the Heroes tab</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {heroes.map(h => (
                <HeroPickCard key={h.id} hero={h} selected={selectedId === h.id} onClick={() => setSelectedId(h.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Wallet info */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px solid #2a1a00" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={14} />
            <span style={{ fontSize: "0.65rem", color: "#a08040" }}>Your RuneX</span>
          </div>
          <span style={{ fontFamily: "'Cinzel',serif", fontSize: "0.8rem", fontWeight: 700, color: canAfford ? "#ff6060" : "#ef4444" }}>
            {(player?.runex ?? 0).toLocaleString()}
          </span>
        </div>

        {/* CTA */}
        {!selectedHero ? null : !heroQual ? (
          <div style={{ padding: "12px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", textAlign: "center" }}>
            <p style={{ fontSize: "0.72rem", color: "#ef4444" }}>
              {CLASS_LABEL[selectedHero.hero_class]} is Lv.{selectedHero.hero_level ?? 0} — needs Lv.{LEVEL_NEEDED}
            </p>
            <p style={{ fontSize: "0.6rem", color: "#6b4f10", marginTop: 4 }}>
              Earn {Math.max(0, 100_000 - selectedHero.total_runex_earned).toLocaleString()} more RuneX in daily HeroX battles
            </p>
          </div>
        ) : !canAfford ? (
          <div style={{ padding: "12px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", textAlign: "center" }}>
            <p style={{ fontSize: "0.72rem", color: "#ef4444" }}>
              Need {(ENTRY_COST - (player?.runex ?? 0)).toLocaleString()} more RuneX
            </p>
            <p style={{ fontSize: "0.6rem", color: "#6b4f10", marginTop: 4 }}>
              Open RuneX chests or win HeroX battles to earn RuneX
            </p>
          </div>
        ) : (
          <button
            onClick={handleEnter}
            disabled={loading}
            style={{
              width: "100%", padding: "15px 0",
              borderRadius: 12, cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "rgba(30,0,0,0.6)" : "linear-gradient(135deg,#6a0000 0%,#2d0000 100%)",
              border: `1px solid ${loading ? "#3d0000" : "#cc2200"}`,
              boxShadow: loading ? "none" : "0 0 28px rgba(139,0,0,0.35), inset 0 1px 0 rgba(255,100,0,0.1)",
              transition: "all 0.2s",
            }}>
            <p style={{ fontFamily: "'Cinzel',serif", color: loading ? "#6b4f10" : "#ffcc00", fontWeight: 900, fontSize: "0.95rem", letterSpacing: "0.05em" }}>
              {loading ? "⚔ Entering arena…" : "⚔ ENTER BATTLE ROYALE"}
            </p>
            {!loading && (
              <p style={{ fontSize: "0.6rem", color: "#a06040", marginTop: 3 }}>
                Cost: 100,000 RuneX · Balance after: {((player?.runex ?? 0) - ENTRY_COST).toLocaleString()}
              </p>
            )}
          </button>
        )}
      </div>
    );
  }

  // ── FIGHTING ─────────────────────────────────────────────────────────────────
  if (pageState === "fighting" && curFight) {
    const heroSrcs = selectedHero ? (HERO_SPRITES[selectedHero.hero_class]?.[selectedHero.rarity] ?? []) : [];
    const oppSrcs  = HERO_SPRITES[curFight.opponent_class]?.[curFight.opponent_rarity] ?? [];
    const heroDead = heroHpPct <= 0;
    const oppDead  = oppHpPct  <= 0;
    const rCol     = RARITY_COLOR[curFight.opponent_rarity];

    return (
      <div className="animate-fade-in" style={{ paddingBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Fight track */}
        <div style={{ padding: "10px 0" }}>
          <FightTrack result={null} currentFight={curFightNum} />
        </div>

        {/* Fight header */}
        <div style={{
          borderRadius: 12, padding: "10px 14px",
          background: fightPhase === "intro" ? `linear-gradient(135deg,${rCol}18,rgba(0,0,0,0.6))` : "rgba(0,0,0,0.35)",
          border: `1px solid ${rCol}40`,
          transition: "background 0.5s",
          textAlign: "center",
        }}>
          <p style={{ fontSize: "0.58rem", color: "#6b4f10", fontFamily: "'Cinzel',serif", letterSpacing: "0.12em" }}>FIGHT {curFightNum} / 7</p>
          <p style={{ fontFamily: "'Cinzel',serif", color: "#e8d9a0", fontSize: "0.9rem", fontWeight: 900, marginTop: 2 }}>
            {curFight.opponent_name}
          </p>
          <p style={{ fontSize: "0.58rem", color: rCol, marginTop: 1 }}>
            {curFight.opponent_rarity} {CLASS_LABEL[curFight.opponent_class]} {CLASS_ICON[curFight.opponent_class]}
          </p>
        </div>

        {/* Arena */}
        <div style={{
          borderRadius: 16, padding: "14px 12px",
          background: "linear-gradient(180deg,rgba(60,0,0,0.15) 0%,rgba(0,0,0,0.55) 100%)",
          border: "1px solid rgba(139,0,0,0.25)",
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <FighterCard
              srcs={heroSrcs}
              fallback={selectedHero ? CLASS_ICON[selectedHero.hero_class] : "⚔"}
              name={selectedHero ? CLASS_LABEL[selectedHero.hero_class] : "Hero"}
              rarity={selectedHero?.rarity ?? "common"}
              subtitle={`Lv.${selectedHero?.hero_level ?? 0} · ${selectedHero?.rarity ?? "common"}`}
              hpPct={heroHpPct}
              side="left"
              shaking={heroShaking}
              dead={heroDead}
            />

            {/* VS */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 30, minWidth: 24 }}>
              <div style={{
                fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: "0.65rem",
                color: fightPhase === "battle" ? "#cc3300" : "#3d2a00",
                textShadow: fightPhase === "battle" ? "0 0 10px rgba(200,50,0,0.5)" : "none",
                transition: "all 0.4s",
              }}>VS</div>
            </div>

            <FighterCard
              srcs={oppSrcs}
              fallback={CLASS_ICON[curFight.opponent_class]}
              name={curFight.opponent_name}
              rarity={curFight.opponent_rarity}
              subtitle={`${curFight.opponent_rarity} ${CLASS_LABEL[curFight.opponent_class]}`}
              hpPct={oppHpPct}
              side="right"
              shaking={oppShaking}
              dead={oppDead}
            />
          </div>
        </div>

        {/* Combat log */}
        <div ref={logRef} style={{
          borderRadius: 10, padding: "10px 12px",
          background: "rgba(0,0,0,0.5)", border: "1px solid #1a0e00",
          maxHeight: 150, minHeight: 70, overflowY: "auto",
          fontFamily: "'Courier New', monospace",
        }}>
          {narrativeLines.length === 0 ? (
            <p className="animate-pulse" style={{ fontSize: "0.62rem", color: "#3d2a00", textAlign: "center", paddingTop: 16 }}>
              ⚔ Combat begins…
            </p>
          ) : (
            narrativeLines.map((line, i) => {
              const isWin    = line.startsWith("✅");
              const isLose   = line.startsWith("💀");
              const isHeroAtk = line.startsWith("Your ");
              return (
                <p key={i} style={{
                  fontSize: "0.62rem", marginBottom: 3,
                  color: isWin ? "#4ade80" : isLose ? "#ef4444" : isHeroAtk ? "#fbbf24" : "#7a6040",
                  fontWeight: isWin || isLose ? 700 : 400,
                }}>
                  {line}
                </p>
              );
            })
          )}
          {fightPhase === "battle" && (
            <span className="animate-pulse" style={{ fontSize: "0.62rem", color: "#ffcc00" }}>▌</span>
          )}
        </div>
      </div>
    );
  }

  // ── DONE ─────────────────────────────────────────────────────────────────────
  if (pageState === "done" && result) {
    const wonFights = result.fights.filter(f => f.won).length;
    const heroSrcs  = selectedHero ? (HERO_SPRITES[selectedHero.hero_class]?.[selectedHero.rarity] ?? []) : [];

    return (
      <div className="animate-fade-in" style={{ paddingBottom: 20 }}>

        {/* Result banner */}
        <div style={{
          borderRadius: 16, padding: "24px 18px", marginBottom: 20, textAlign: "center",
          background: result.won
            ? "linear-gradient(160deg,rgba(74,222,128,0.12),rgba(0,0,0,0.7))"
            : "linear-gradient(160deg,rgba(239,68,68,0.1),rgba(0,0,0,0.7))",
          border: `2px solid ${result.won ? "rgba(74,222,128,0.35)" : "rgba(239,68,68,0.25)"}`,
          boxShadow: result.won ? "0 0 40px rgba(74,222,128,0.08)" : "none",
        }}>
          {result.won ? (
            <>
              <OsrsSprite srcs={heroSrcs} fallback="⚔" size={80} pixelated={false} />
              <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "1.4rem", fontWeight: 900, marginTop: 12, textShadow: "0 0 20px rgba(255,204,0,0.4)", letterSpacing: "0.06em" }}>
                🏆 CHAMPION
              </p>
              <p style={{ color: "#a08040", fontSize: "0.7rem", marginTop: 4 }}>All 7 opponents vanquished</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 14, padding: "10px 16px", borderRadius: 10, background: "rgba(255,96,96,0.08)", border: "1px solid rgba(255,96,96,0.2)" }}>
                <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={26} />
                <span style={{ fontFamily: "'Cinzel',serif", color: "#ff6060", fontSize: "1.3rem", fontWeight: 900 }}>+1,000,000 RuneX</span>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: "2.5rem", marginBottom: 8 }}>💀</p>
              <p style={{ fontFamily: "'Cinzel',serif", color: "#ef4444", fontSize: "1.2rem", fontWeight: 900, letterSpacing: "0.06em" }}>DEFEATED</p>
              <p style={{ color: "#a08040", fontSize: "0.7rem", marginTop: 6 }}>
                Reached Fight {wonFights + 1} — won {wonFights} / 7
              </p>
            </>
          )}
        </div>

        {/* Fight summary track */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontFamily: "'Cinzel',serif", color: "#a08040", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>FIGHT LOG</p>
          <FightTrack result={result} currentFight={0} />
        </div>

        {/* Fight details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          {result.fights.map(fight => {
            const rCol = RARITY_COLOR[fight.opponent_rarity];
            return (
              <div key={fight.fight_number} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                borderRadius: 10,
                background: fight.won ? "rgba(74,222,128,0.05)" : "rgba(239,68,68,0.05)",
                border: `1px solid ${fight.won ? "rgba(74,222,128,0.12)" : "rgba(239,68,68,0.12)"}`,
              }}>
                <span style={{ fontSize: "0.85rem" }}>{fight.won ? "✅" : "💀"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "0.68rem", fontWeight: 700, color: fight.won ? "#4ade80" : "#ef4444", fontFamily: "'Cinzel',serif" }}>
                    Fight {fight.fight_number} — {fight.opponent_name}
                  </p>
                  <p style={{ fontSize: "0.58rem", color: "#6b4f10", marginTop: 1 }}>
                    {fight.rounds} rounds · {fight.won ? `${fight.hp_left} HP remaining` : "defeated"}
                  </p>
                </div>
                <span style={{ fontSize: "0.58rem", fontWeight: 700, color: rCol, padding: "2px 7px", borderRadius: 8, border: `1px solid ${rCol}33`, background: `${rCol}11` }}>
                  {fight.opponent_rarity}
                </span>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => { setPageState("lobby"); setResult(null); setCurFight(null); refresh(); }}
          style={{
            width: "100%", padding: "13px",
            borderRadius: 10, cursor: "pointer",
            background: "rgba(0,0,0,0.4)", border: "1px solid #3d2a00",
            fontFamily: "'Cinzel',serif", color: "#a08040", fontWeight: 700, fontSize: "0.85rem",
            transition: "border-color 0.2s",
          }}>
          ↩ Return to Lobby
        </button>
      </div>
    );
  }

  return null;
}
