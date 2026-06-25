import { useState, useEffect, useCallback, useRef } from "react";
import { useGameStore } from "../store";
import { getPlayer, mintHero, burnHero, submitHeroBattle } from "../api";
import type { HeroX } from "../api";
import { OsrsSprite, OsrsIcon } from "../components/OsrsSprite";
import { HERO_SPRITES, HERO_MONSTER_SPRITES, STAT_ICONS, RUNEX_ICON } from "../sprites";

const RARITY_COLOR: Record<string, string> = {
  common: "#9ca3af", rare: "#60a5fa", epic: "#c084fc", legendary: "#fbbf24",
};
const RARITY_BORDER: Record<string, string> = {
  common: "rgba(156,163,175,0.25)", rare: "rgba(96,165,250,0.3)",
  epic: "rgba(192,132,252,0.3)", legendary: "rgba(251,191,36,0.35)",
};
const RARITY_BG: Record<string, string> = {
  common: "rgba(156,163,175,0.07)", rare: "rgba(96,165,250,0.07)",
  epic: "rgba(192,132,252,0.07)", legendary: "rgba(251,191,36,0.07)",
};

const CLASS_LABEL: Record<string, string> = {
  berserker: "Berserker", ranger: "Ranger", sorcerer: "Sorcerer", paladin: "Paladin",
};
const CLASS_ICON: Record<string, string> = {
  berserker: "⚔️", ranger: "🏹", sorcerer: "🔮", paladin: "🛡️",
};

const PHASES = [
  { phase: 1, name: "Goblin Chieftain", hp: 20,  atk: 8,   def: 5,   weakness: "berserker", location: "Lumbridge" },
  { phase: 2, name: "Ice Queen",        hp: 60,  atk: 25,  def: 20,  weakness: "ranger",    location: "White Wolf Mountain" },
  { phase: 3, name: "Chaos Wizard",     hp: 120, atk: 55,  def: 45,  weakness: "paladin",   location: "Varrock" },
  { phase: 4, name: "Blue Dragon",      hp: 200, atk: 90,  def: 80,  weakness: "sorcerer",  location: "Taverley Dungeon" },
  { phase: 5, name: "Zulrah",           hp: 250, atk: 110, def: 100, weakness: "ranger",    location: "Mor Ul Rek" },
];

const PHASE_RUNEX = [0, 500, 2000, 8000, 35000, 100000];
const HERO_FIGHT_STAT: Record<string, keyof HeroX["stats"]> = {
  berserker: "attack", ranger: "ranged", sorcerer: "magic", paladin: "attack",
};

function simulatePhase(hero: HeroX, phaseIdx: number): { win: boolean; hpLeft: number } {
  const m        = PHASES[phaseIdx];
  const statKey  = HERO_FIGHT_STAT[hero.hero_class];
  const rawAtk   = hero.stats[statKey];
  const typeMatch = m.weakness === hero.hero_class;
  const effAtk    = rawAtk * (typeMatch ? 1.5 : 0.8);

  const charHit = effAtk / (effAtk + m.def + 1);
  const monHit  = m.atk  / (m.atk  + hero.stats.defense + 1);
  const charDpt = charHit * effAtk * 0.5;
  const monDpt  = monHit  * m.atk  * 0.5;

  const turnsKill     = m.hp          / Math.max(0.01, charDpt);
  const turnsSurvived = hero.stats.hp / Math.max(0.01, monDpt);

  const win    = turnsSurvived >= turnsKill;
  const hpLeft = Math.max(0, Math.round(hero.stats.hp - turnsKill * monDpt));
  return { win, hpLeft };
}

function fmtRunex(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function timeUntilReset() {
  const now      = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const ms       = midnight.getTime() - now.getTime();
  const h        = Math.floor(ms / 3_600_000);
  const m        = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

// Stat bar
function StatBar({ label, value, max, color, icon, isPrimary }: {
  label: string; value: number; max: number; color: string; icon: string; isPrimary?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <OsrsIcon src={icon} fallback="" size={11} />
      <span style={{ color: "#a08040", fontFamily: "'Cinzel',serif", fontSize: "0.58rem", width: 44, textTransform: "capitalize" }}>{label}</span>
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, background: "rgba(0,0,0,0.45)", border: "1px solid #3d2a00" }}>
        <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: "0.6rem", fontWeight: 700, width: 28, textAlign: "right", color: isPrimary ? "#ffcc00" : "#ffe8a0" }}>
        {value}{isPrimary && <span style={{ color: "#ffcc00" }}>★</span>}
      </span>
    </div>
  );
}

// Battle overlay
type BattleState = "idle" | "fighting" | "done";
interface BattleLog { phase: number; monName: string; win: boolean; hpLeft: number; typeMatch: boolean; runex: number; }

function BattleOverlay({ hero, wallet, onClose, onDone }: {
  hero: HeroX;
  wallet: string;
  onClose: () => void;
  onDone:  (phasesCompleted: number, runexEarned: number) => void;
}) {
  const [state,         setState]       = useState<BattleState>("idle");
  const [currentPhase,  setCurrentPhase] = useState(0);
  const [log,           setLog]          = useState<BattleLog[]>([]);
  const [submitting,    setSubmitting]   = useState(false);
  const [submitted,     setSubmitted]    = useState(false);
  const runRef             = useRef(false);
  const phasesCompletedRef = useRef(0);
  const totalRunexRef      = useRef(0);

  async function startBattle() {
    if (runRef.current) return;
    runRef.current = true;
    setState("fighting");
    setLog([]);
    phasesCompletedRef.current = 0;
    totalRunexRef.current      = 0;

    for (let i = 0; i < PHASES.length; i++) {
      setCurrentPhase(i + 1);
      await new Promise(r => setTimeout(r, 1800));
      const { win, hpLeft } = simulatePhase(hero, i);
      const phaseRunex = win ? PHASE_RUNEX[i + 1] : 0;
      if (win) {
        phasesCompletedRef.current = i + 1;
        totalRunexRef.current     += phaseRunex;
      }
      setLog(prev => [...prev, {
        phase: i + 1, monName: PHASES[i].name, win, hpLeft,
        typeMatch: PHASES[i].weakness === hero.hero_class, runex: phaseRunex,
      }]);
      if (!win) break;
      if (i < PHASES.length - 1) await new Promise(r => setTimeout(r, 500));
    }
    setState("done");
  }

  const [droppedItems, setDroppedItems] = useState<import("../api").CharacterItem[]>([]);

  async function claimAndClose() {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      const res = await submitHeroBattle(wallet, hero.id, phasesCompletedRef.current);
      setDroppedItems(res.items_dropped ?? []);
      setSubmitted(true);
      onDone(phasesCompletedRef.current, totalRunexRef.current);
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Error submitting battle");
    } finally {
      setSubmitting(false);
    }
  }

  const completedPhases = phasesCompletedRef.current;
  const totalRunex      = totalRunexRef.current;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.85)" }} onClick={e => { if (e.target === e.currentTarget && state !== "fighting") onClose(); }}>
      <div className="w-full max-w-lg rounded-t-3xl overflow-hidden" style={{ background: "#1a1200", border: "2px solid #6b4f10", maxHeight: "88vh", overflowY: "auto" }}>
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between" style={{ borderBottom: "1px solid #3d2a00" }}>
          <div>
            <h2 style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "1.1rem", fontWeight: 900 }}>
              {CLASS_ICON[hero.hero_class]} {CLASS_LABEL[hero.hero_class]} Battle
            </h2>
            <p className="text-xs" style={{ color: "#a08040" }}>
              {hero.rarity_emoji} {hero.rarity} — 1 attempt per day
            </p>
          </div>
          {state !== "fighting" && (
            <button onClick={onClose} style={{ color: "#a08040", fontSize: "1.2rem" }}>✕</button>
          )}
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Idle state */}
          {state === "idle" && (
            <div className="text-center space-y-4">
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,204,0,0.04)", border: "1px solid rgba(255,204,0,0.12)" }}>
                <p className="text-sm text-gray-300 mb-1">
                  Your <strong style={{ color: RARITY_COLOR[hero.rarity] }}>{hero.rarity} {CLASS_LABEL[hero.hero_class]}</strong> will fight through 5 phases.
                </p>
                <p className="text-xs text-gray-500">Each defeat ends the run. Rewards depend on how far you get.</p>
                <div className="mt-3 space-y-1">
                  {PHASES.map((p, i) => (
                    <div key={p.phase} className="flex items-center justify-between text-xs px-2">
                      <span style={{ color: "#a08040" }}>Phase {p.phase} — {p.name}</span>
                      <span style={{ color: "#ffcc00", fontWeight: 700 }}>+{fmtRunex(PHASE_RUNEX[i + 1])} RuneX</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs" style={{ color: hero.hero_class === PHASES[0].weakness ? "#6dde6d" : "#a08040" }}>
                {hero.hero_class === "berserker" ? "You have type advantage in phase 1!" :
                 hero.hero_class === "ranger"    ? "You have type advantage in phases 2 & 5!" :
                 hero.hero_class === "paladin"   ? "You have type advantage in phase 3!" :
                                                   "You have type advantage in phase 4!"}
              </p>
              <button onClick={startBattle} className="osrs-btn-green w-full text-base py-3">
                ⚔ Start Battle
              </button>
            </div>
          )}

          {/* Fighting state */}
          {state === "fighting" && (
            <div className="space-y-3">
              {currentPhase > 0 && currentPhase <= PHASES.length && (
                <div className="rounded-2xl p-4 text-center animate-pulse" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <OsrsSprite srcs={HERO_MONSTER_SPRITES[currentPhase] ?? []} fallback="👾" size={96} pixelated={false} />
                  <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontWeight: 900, marginTop: 8 }}>
                    Phase {currentPhase} — {PHASES[currentPhase - 1].name}
                  </p>
                  <p className="text-xs text-gray-500">{PHASES[currentPhase - 1].location}</p>
                  <p className="text-xs mt-2" style={{ color: "#a08040" }}>⚔ Battling…</p>
                </div>
              )}

              {log.map(entry => (
                <div key={entry.phase} className="flex items-center gap-3 rounded-xl px-3 py-2"
                     style={{ background: entry.win ? "rgba(109,222,109,0.07)" : "rgba(239,68,68,0.07)", border: `1px solid ${entry.win ? "rgba(109,222,109,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                  <span className="text-lg">{entry.win ? "✅" : "💀"}</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold" style={{ color: entry.win ? "#6dde6d" : "#ef4444" }}>
                      Phase {entry.phase} — {entry.monName} {entry.typeMatch && "⚡"}
                    </p>
                    <p className="text-xs text-gray-500">{entry.win ? `Hero survived — ${entry.hpLeft} HP left` : "Hero was defeated"}</p>
                  </div>
                  {entry.win && <span style={{ color: "#ffcc00", fontWeight: 700, fontSize: "0.75rem" }}>+{fmtRunex(entry.runex)}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Done state */}
          {state === "done" && (
            <div className="space-y-4">
              <div className="rounded-2xl p-4 text-center" style={{ background: completedPhases > 0 ? "rgba(109,222,109,0.07)" : "rgba(239,68,68,0.07)", border: `1px solid ${completedPhases > 0 ? "rgba(109,222,109,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                {completedPhases === 5
                  ? <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "1rem", fontWeight: 900 }}>🏆 ALL PHASES CLEARED!</p>
                  : completedPhases > 0
                    ? <p style={{ fontFamily: "'Cinzel',serif", color: "#6dde6d", fontSize: "0.95rem", fontWeight: 900 }}>⚔ Reached Phase {completedPhases + 1}!</p>
                    : <p style={{ fontFamily: "'Cinzel',serif", color: "#ef4444", fontSize: "0.95rem", fontWeight: 900 }}>💀 Fell at Phase 1</p>
                }
                <p className="text-xs text-gray-400 mt-1">
                  {completedPhases === 0 ? "No RuneX earned this run" : `Completed ${completedPhases} phase${completedPhases > 1 ? "s" : ""}`}
                </p>
                {totalRunex > 0 && (
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={24} />
                    <span style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "1.3rem", fontWeight: 900 }}>
                      +{fmtRunex(totalRunex)} RuneX
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {log.map(entry => (
                  <div key={entry.phase} className="flex items-center gap-3 rounded-xl px-3 py-2"
                       style={{ background: entry.win ? "rgba(109,222,109,0.07)" : "rgba(239,68,68,0.07)", border: `1px solid ${entry.win ? "rgba(109,222,109,0.15)" : "rgba(239,68,68,0.15)"}` }}>
                    <span>{entry.win ? "✅" : "💀"}</span>
                    <div className="flex-1">
                      <p className="text-xs font-bold" style={{ color: entry.win ? "#6dde6d" : "#ef4444" }}>
                        Phase {entry.phase} — {entry.monName} {entry.typeMatch && <span style={{ color: "#a0ffb0" }}>⚡ Type Adv.</span>}
                      </p>
                      <p className="text-xs text-gray-500">{entry.win ? `${entry.hpLeft} HP remaining` : "Defeated"}</p>
                    </div>
                    {entry.win && <span style={{ color: "#ffcc00", fontWeight: 700, fontSize: "0.7rem" }}>+{fmtRunex(entry.runex)}</span>}
                  </div>
                ))}
              </div>

              {!submitted
                ? <button onClick={claimAndClose} disabled={submitting} className="osrs-btn-green w-full text-base py-3">
                    {submitting ? "Saving…" : totalRunex > 0 ? `💎 Claim ${fmtRunex(totalRunex)} RuneX` : "✕ Close"}
                  </button>
                : <div className="space-y-2">
                    <div className="text-center py-2">
                      <p style={{ color: "#6dde6d", fontWeight: 700 }}>RuneX claimed! ✔</p>
                    </div>
                    {droppedItems.length > 0 && (
                      <div className="rounded-xl p-3" style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}>
                        <p className="text-xs font-bold mb-2 text-center" style={{ color: "#ffcc00" }}>
                          🎁 Itens Encontrados!
                        </p>
                        <div className="space-y-1">
                          {droppedItems.map(item => (
                            <div key={item.id} className="flex items-center gap-2 text-xs" style={{ color: "#ffe8a0" }}>
                              <span>📦</span>
                              <span className="font-bold">{item.item_name ?? item.label}</span>
                              <span style={{ color: "#a08040" }}>· {item.item_slot} · {item.item_rarity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <button onClick={onClose} className="osrs-btn w-full px-8">Fechar</button>
                  </div>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hero card
function HeroCard({ hero, wallet, onRefresh }: { hero: HeroX; wallet: string; onRefresh: () => void; }) {
  const [showStats,   setShowStats]   = useState(false);
  const [battleOpen,  setBattleOpen]  = useState(false);
  const [burning,     setBurning]     = useState(false);
  const [confirmBurn, setConfirmBurn] = useState(false);
  const { setPlayer } = useGameStore();
  const heroLevel = hero.hero_level ?? 0;

  const border     = RARITY_BORDER[hero.rarity];
  const bg         = RARITY_BG[hero.rarity];
  const spriteSrcs = HERO_SPRITES[hero.hero_class]?.[hero.rarity] ?? [];
  const statColor  = (stat: string) => ({
    attack: "#ef4444", defense: "#60a5fa", hp: "#6dde6d",
    magic: "#c084fc", ranged: "#fbbf24", speed: "#34d399",
  }[stat] ?? "#a08040");
  const statMax = (stat: string) => stat === "hp" ? 250 : 99;

  async function handleBurn() {
    if (!confirmBurn) { setConfirmBurn(true); return; }
    setBurning(true);
    try {
      await burnHero(wallet, hero.id);
      const p = await getPlayer(wallet); setPlayer(p); onRefresh();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Error");
    } finally { setBurning(false); setConfirmBurn(false); }
  }

  function handleBattleDone(_phases: number, _runex: number) {
    getPlayer(wallet).then(p => setPlayer(p));
    onRefresh();
  }

  return (
    <>
      {battleOpen && (
        <BattleOverlay hero={hero} wallet={wallet} onClose={() => setBattleOpen(false)} onDone={(p, r) => { setBattleOpen(false); handleBattleDone(p, r); }} />
      )}

      <div className="rounded-2xl overflow-hidden" style={{ background: `linear-gradient(160deg,${bg} 0%,rgba(8,8,20,1) 100%)`, border: `1.5px solid ${border}` }}>
        <div className="flex items-start gap-4 px-4 py-4">
          {/* Sprite */}
          <div className="flex-shrink-0 rounded-xl flex items-center justify-center"
               style={{ width: 90, height: 110, background: "rgba(0,0,0,0.35)", border: `1px solid ${border}`, overflow: "hidden" }}>
            <OsrsSprite srcs={spriteSrcs} fallback={CLASS_ICON[hero.hero_class]} size={100} pixelated={false} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontFamily: "'Cinzel',serif", fontWeight: 900, color: "#fff", fontSize: "0.95rem" }}>
                {CLASS_ICON[hero.hero_class]} {CLASS_LABEL[hero.hero_class]}
              </span>
              <span className={`text-xs font-bold osrs-label-${hero.rarity}`}>{hero.rarity_emoji} {hero.rarity}</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                    style={{ background: heroLevel >= 10 ? "rgba(255,204,0,0.15)" : "rgba(0,0,0,0.3)", border: `1px solid ${heroLevel >= 10 ? "#ffcc00" : "#3d2a00"}`, color: heroLevel >= 10 ? "#ffcc00" : "#6b4f10" }}>
                Lv.{heroLevel}
              </span>
            </div>
            {hero.best_phase > 0 && (
              <p className="text-xs mt-0.5" style={{ color: "#a08040" }}>Best: Phase {hero.best_phase} · {fmtRunex(hero.total_runex_earned)} RuneX earned</p>
            )}

            {/* Battle status */}
            {hero.can_battle
              ? <div className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: "rgba(109,222,109,0.12)", border: "1px solid rgba(109,222,109,0.3)", color: "#6dde6d" }}>
                  ● Ready to Battle
                </div>
              : <div className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: "rgba(156,163,175,0.1)", border: "1px solid rgba(156,163,175,0.2)", color: "#6b7280" }}>
                  ⏳ Resets in {timeUntilReset()}
                </div>
            }

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              {hero.can_battle && (
                <button onClick={() => setBattleOpen(true)} className="osrs-btn-green text-xs px-3 py-1.5">⚔ Battle</button>
              )}
              <button onClick={() => setShowStats(v => !v)} className="osrs-btn text-xs px-3 py-1.5">
                {showStats ? "▲ Stats" : "▼ Stats"}
              </button>
              <button
                onClick={handleBurn}
                disabled={burning}
                style={{ fontSize: "0.65rem", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.07)", color: confirmBurn ? "#ef4444" : "#6b7280", cursor: "pointer" }}>
                {burning ? "…" : confirmBurn ? "Confirm burn?" : "🔥 Burn"}
              </button>
            </div>
          </div>
        </div>

        {/* Stat bars */}
        {showStats && (
          <div className="px-4 pb-4 space-y-1.5" style={{ borderTop: `1px solid ${border}`, paddingTop: 12 }}>
            {(["attack","defense","hp","magic","ranged","speed"] as const).map(stat => (
              <StatBar
                key={stat}
                label={stat}
                value={hero.stats[stat]}
                max={statMax(stat)}
                color={statColor(stat)}
                icon={STAT_ICONS[stat]?.[0] ?? ""}
                isPrimary={hero.primary_stat === stat}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// Empty slot
function EmptySlot({ onMint, minting, canAfford, mintCost }: {
  onMint: () => void; minting: boolean; canAfford: boolean; mintCost: number;
}) {
  return (
    <div className="rounded-2xl flex flex-col items-center justify-center py-8 gap-3"
         style={{ border: "2px dashed #3d2a00", background: "rgba(0,0,0,0.2)" }}>
      <p style={{ fontFamily: "'Cinzel',serif", color: "#6b4f10", fontSize: "0.85rem" }}>Empty Slot</p>
      <p className="text-xs text-center px-4" style={{ color: "#6b4f10" }}>
        Mint a HeroX to fill this slot.<br />
        <span style={{ color: canAfford ? "#ffcc00" : "#ef4444" }}>{mintCost.toLocaleString()} Gold</span> required.
      </p>
      <button onClick={onMint} disabled={minting || !canAfford} className={canAfford ? "osrs-btn-green" : "osrs-btn"} style={{ fontSize: "0.85rem" }}>
        {minting ? "Minting…" : canAfford ? "✨ Mint HeroX" : "Need more Gold"}
      </button>
    </div>
  );
}

// Main page
const MINT_COST = 100_000;
const MAX_SLOTS = 3;

export default function Heroes() {
  const { wallet, player, setPlayer } = useGameStore();
  const [loading,    setLoading]    = useState(false);
  const [minting,    setMinting]    = useState(false);
  const [mintResult, setMintResult] = useState<HeroX | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try { const p = await getPlayer(wallet); setPlayer(p); }
    finally { setLoading(false); }
  }, [wallet, setPlayer]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!wallet) return <p className="text-center text-gray-500 py-20">Connect wallet first.</p>;

  const heroes     = player?.heroes ?? [];
  const emptySlots = Math.max(0, MAX_SLOTS - heroes.length);
  const canAfford  = (player?.tokens ?? 0) >= MINT_COST;

  async function handleMint() {
    if (minting || !wallet || !canAfford) return;
    setMinting(true);
    try {
      const res = await mintHero(wallet);
      const p   = await getPlayer(wallet); setPlayer(p);
      setMintResult(res.hero);
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Error minting hero");
    } finally { setMinting(false); }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "1.5rem", fontWeight: 900 }}>⚔ Heroes</h1>
          <p className="text-xs" style={{ color: "#a08040" }}>
            {heroes.length}/{MAX_SLOTS} slots · Daily battles earn RuneX
          </p>
        </div>
        <button onClick={refresh} disabled={loading} style={{ color: "#a08040", fontSize: "0.75rem" }}>
          {loading ? "…" : "↺ Refresh"}
        </button>
      </div>

      {/* RuneX + Gold strip */}
      <div className="rounded-2xl px-4 py-3 flex items-center justify-between"
           style={{ background: "linear-gradient(135deg,rgba(139,0,0,0.1),rgba(8,8,20,1))", border: "1px solid rgba(160,0,0,0.25)" }}>
        <div>
          <p className="text-xs text-gray-500">Gold (GP) — Mint heroes</p>
          <p style={{ color: "#ffcc00", fontWeight: 700, fontFamily: "'Cinzel',serif" }}>{(player?.tokens ?? 0).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">RuneX — from battles</p>
          <div className="flex items-center gap-1 justify-end">
            <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={16} />
            <p style={{ color: "#ff6060", fontWeight: 700, fontFamily: "'Cinzel',serif" }}>{(player?.runex ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Mint result toast */}
      {mintResult && (
        <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(109,222,109,0.07)", border: "1px solid rgba(109,222,109,0.2)" }}>
          <p style={{ color: "#6dde6d", fontWeight: 700 }}>✨ HeroX Minted!</p>
          <p className="text-sm mt-1" style={{ color: "#ffe8a0" }}>
            {mintResult.rarity_emoji} {mintResult.rarity} {CLASS_LABEL[mintResult.hero_class]}
          </p>
          <button onClick={() => setMintResult(null)} className="text-xs mt-2" style={{ color: "#a08040" }}>dismiss</button>
        </div>
      )}

      {/* How it works */}
      {heroes.length === 0 && (
        <div className="osrs-panel p-4 space-y-2">
          <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontWeight: 700, fontSize: "0.85rem" }}>How HeroX Works</p>
          <div className="space-y-1 text-xs" style={{ color: "#a08040" }}>
            <p>⚔ Heroes fight monsters daily through 5 difficult phases</p>
            <p>💎 Earn RuneX based on how far you get — resets midnight UTC</p>
            <p>⚡ Each hero class has type advantage vs specific phases</p>
            <p>🔥 Max 3 heroes — burn one to free a slot</p>
            <p>💰 Cost: {MINT_COST.toLocaleString()} Gold to mint each hero</p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {[
              ["berserker", "Phase 1 adv.", "#ef4444"],
              ["ranger",    "Phase 2+5 adv.", "#fbbf24"],
              ["sorcerer",  "Phase 4 adv.", "#c084fc"],
              ["paladin",   "Phase 3 adv.", "#60a5fa"],
            ].map(([cls, tip, col]) => (
              <div key={cls} className="rounded-lg px-2 py-1.5 text-center" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid #3d2a00" }}>
                <span style={{ color: col as string, fontWeight: 700 }}>{CLASS_ICON[cls as string]} {CLASS_LABEL[cls as string]}</span>
                <p style={{ color: "#6b4f10" }}>{tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hero slots */}
      <div className="space-y-4">
        {heroes.map(h => (
          <HeroCard key={h.id} hero={h} wallet={wallet} onRefresh={refresh} />
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <EmptySlot key={`empty-${i}`} onMint={handleMint} minting={minting} canAfford={canAfford} mintCost={MINT_COST} />
        ))}
      </div>
    </div>
  );
}
