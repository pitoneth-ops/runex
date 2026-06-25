import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "../store";
import { getPlayer, claimBattleReward } from "../api";
import type { Character } from "../api";
import { OsrsSprite, OsrsIcon } from "../components/OsrsSprite";
import { CHAR_SPRITES, ARMOR_ICONS, STAT_ICONS } from "../sprites";
import { PHASES, type MonsterDef, type Phase } from "../monsters";

// ── Battle simulation ─────────────────────────────────────────────────────────

interface BattleResult {
  win: boolean;
  charHp: number;
  turnsToKill: number;
  turnsSurvived: number;
  weaknessMatch: boolean;
  log: string[];
}

function simulate(char: Character, monster: MonsterDef): BattleResult {
  const s = char.stats;
  const classWeaknessMatch =
    (monster.weakness === "melee"  && char.class_type === "warrior") ||
    (monster.weakness === "ranged" && char.class_type === "archer")  ||
    (monster.weakness === "magic"  && char.class_type === "mage");

  const primaryStat =
    char.class_type === "warrior" ? s.attack :
    char.class_type === "archer"  ? s.ranged :
    char.class_type === "mage"    ? s.magic  : s.attack;

  const effectiveAtk = primaryStat * (classWeaknessMatch ? 1.5 : 0.8);

  // Relevant monster defense based on char type
  const monsterDef =
    char.class_type === "mage"   ? (monster.def + monster.magic_def) / 2 :
    char.class_type === "archer" ? (monster.def + monster.ranged_def) / 2 : monster.def;

  const charHitChance    = effectiveAtk / (effectiveAtk + monsterDef + 1);
  const monsterHitChance = monster.atk  / (monster.atk + s.defense + 1);

  const charDPT    = charHitChance    * effectiveAtk * 0.5;
  const monsterDPT = monsterHitChance * monster.atk  * 0.5;

  const turnsToKill   = monster.hp  / Math.max(0.1, charDPT);
  const turnsSurvived = s.hp        / Math.max(0.1, monsterDPT);
  const win = turnsSurvived >= turnsToKill;
  const hpLeft = Math.max(0, Math.round(s.hp - turnsToKill * monsterDPT));

  const log: string[] = [
    classWeaknessMatch
      ? `✅ ${char.class_type.toUpperCase()} has type advantage!`
      : `⚠️ No type advantage — monster is resistant.`,
    `⚔ You deal ~${charDPT.toFixed(1)} dmg/turn. ${monster.name} has ${monster.hp} HP → ${Math.ceil(turnsToKill)} turns to kill.`,
    `🛡 Monster deals ~${monsterDPT.toFixed(1)} dmg/turn. You have ${s.hp} HP → survive ${Math.ceil(turnsSurvived)} turns.`,
    win
      ? `🏆 Victory! You defeat ${monster.name} with ${hpLeft} HP remaining!`
      : `💀 Defeated! ${monster.name} overpowers you after ${Math.ceil(turnsSurvived)} turns.`,
  ];

  return { win, charHp: hpLeft, turnsToKill, turnsSurvived, weaknessMatch: classWeaknessMatch, log };
}

// ── Stat bar ──────────────────────────────────────────────────────────────────

const STAT_COLOR: Record<string, string> = {
  attack:  "#ef4444",
  defense: "#60a5fa",
  hp:      "#6dde6d",
  magic:   "#c084fc",
  ranged:  "#fbbf24",
  speed:   "#34d399",
};

function StatBar({ label, icon, value, isPrimary }: { label: string; icon: string[]; value: number; isPrimary?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <OsrsIcon src={icon[0]} fallback="" size={14} />
      <span className="text-xs w-12" style={{ color: "#a08040", fontFamily: "'Cinzel',serif", fontSize: "0.6rem" }}>{label}</span>
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, background: "rgba(0,0,0,0.4)", border: "1px solid #3d2a00" }}>
        <div style={{
          width: `${value}%`, height: "100%",
          background: STAT_COLOR[label.toLowerCase()] ?? "#ffcc00",
          boxShadow: isPrimary ? `0 0 6px ${STAT_COLOR[label.toLowerCase()]}` : undefined,
          borderRadius: 99,
        }} />
      </div>
      <span className="text-xs font-black w-6 text-right" style={{ color: isPrimary ? "#ffcc00" : "#ffe8a0", fontSize: "0.65rem" }}>{value}</span>
      {isPrimary && <span className="text-xs" style={{ color: "#ffcc00", fontSize: "0.6rem" }}>★</span>}
    </div>
  );
}

function CharCard({ char, selected, onClick }: { char: Character; selected: boolean; onClick: () => void }) {
  const spriteSrcs = CHAR_SPRITES[char.class_type]?.[char.rarity] ?? [];
  const armorSrc   = ARMOR_ICONS[char.class_type]?.[char.rarity]  ?? "";
  const s = char.stats;
  const RARITY_BORDER: Record<string, string> = { common:"rgba(156,163,175,0.4)",rare:"rgba(96,165,250,0.5)",epic:"rgba(192,132,252,0.5)",legendary:"rgba(251,191,36,0.6)" };

  return (
    <button onClick={onClick}
      className="rounded-xl p-3 text-left w-full transition-all"
      style={{
        background: selected ? "rgba(255,204,0,0.1)" : "rgba(0,0,0,0.3)",
        border: `2px solid ${selected ? "#ffcc00" : RARITY_BORDER[char.rarity]}`,
        outline: selected ? "1px solid #ffcc0066" : "none",
      }}>
      <div className="flex items-center gap-2 mb-2">
        <OsrsSprite srcs={spriteSrcs} fallback={char.emoji} size={36} />
        <OsrsIcon   src={armorSrc}   fallback=""            size={18} />
        <div>
          <p className="font-black capitalize text-xs" style={{ fontFamily:"'Cinzel',serif", color:"#ffe8a0" }}>{char.class_type}</p>
          <p className={`text-xs osrs-label-${char.rarity} capitalize`}>{char.rarity}</p>
        </div>
      </div>
      <div className="space-y-1">
        <StatBar label="Attack"  icon={STAT_ICONS.attack}  value={s.attack}  isPrimary={char.primary_stat==="attack"}  />
        <StatBar label="Defense" icon={STAT_ICONS.defense} value={s.defense} isPrimary={char.primary_stat==="defense"} />
        <StatBar label="HP"      icon={STAT_ICONS.hp}      value={s.hp}      />
        <StatBar label="Magic"   icon={STAT_ICONS.magic}   value={s.magic}   isPrimary={char.primary_stat==="magic"}   />
        <StatBar label="Ranged"  icon={STAT_ICONS.ranged}  value={s.ranged}  isPrimary={char.primary_stat==="ranged"}  />
        <StatBar label="Speed"   icon={STAT_ICONS.speed}   value={s.speed}   />
      </div>
    </button>
  );
}

function MonsterCard({ monster, selected, onClick }: { monster: MonsterDef; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="rounded-xl p-2 flex flex-col items-center gap-1 transition-all"
      style={{
        background: selected ? "rgba(255,204,0,0.1)" : "rgba(0,0,0,0.3)",
        border: `2px solid ${selected ? "#ffcc00" : "rgba(107,79,16,0.6)"}`,
        minWidth: 80,
      }}>
      <OsrsSprite srcs={monster.sprite} fallback="👾" size={44} />
      <p className="text-xs font-black" style={{ fontFamily:"'Cinzel',serif", color:"#ffe8a0", fontSize:"0.6rem" }}>{monster.name}</p>
      <p className="text-xs" style={{ color:"#a08040", fontSize:"0.55rem" }}>Lv.{monster.level}</p>
      <div className="flex gap-2 text-xs" style={{ color:"#a08040", fontSize:"0.55rem" }}>
        <span>❤{monster.hp}</span>
        <span>⚔{monster.atk}</span>
        <span>🛡{monster.def}</span>
      </div>
      <p className="text-xs font-bold" style={{ color:"#ffcc00", fontSize:"0.55rem" }}>{monster.tokenReward.toLocaleString()} gp</p>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Battle() {
  const { wallet, player, setPlayer } = useGameStore();
  const [loading, setLoading] = useState(false);

  const [selectedPhase,   setSelectedPhase]   = useState<Phase | null>(null);
  const [selectedMonster, setSelectedMonster] = useState<MonsterDef | null>(null);
  const [selectedChar,    setSelectedChar]    = useState<Character | null>(null);
  const [result,          setResult]          = useState<BattleResult | null>(null);
  const [fighting,        setFighting]        = useState(false);
  const [rewardClaimed,   setRewardClaimed]   = useState(false);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try { const p = await getPlayer(wallet); setPlayer(p); }
    finally { setLoading(false); }
  }, [wallet, setPlayer]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!wallet) return <p className="text-center py-20" style={{ color:"#a08040" }}>Connect wallet first.</p>;

  const fighters = (player?.characters ?? []).filter(c => c.class_type !== "miner" && !c.is_staked && c.days_left > 0);

  function selectPhase(phase: Phase) {
    setSelectedPhase(phase);
    setSelectedMonster(null);
    setResult(null);
    setRewardClaimed(false);
  }

  function selectMonster(m: MonsterDef) {
    setSelectedMonster(m);
    setResult(null);
    setRewardClaimed(false);
  }

  function selectChar(c: Character) {
    setSelectedChar(c);
    setResult(null);
    setRewardClaimed(false);
  }

  async function fight() {
    if (!selectedChar || !selectedMonster || !wallet) return;
    setFighting(true);
    setResult(null);
    setRewardClaimed(false);
    await new Promise(r => setTimeout(r, 900)); // animation delay
    const res = simulate(selectedChar, selectedMonster);
    setResult(res);
    setFighting(false);
  }

  async function claimReward() {
    if (!result || !selectedMonster || !wallet) return;
    const tokensWon = result.win ? selectedMonster.tokenReward : 0;
    try {
      const data = await claimBattleReward(wallet, tokensWon, result.win);
      setPlayer({ ...player!, tokens: data.tokens });
      setRewardClaimed(true);
    } catch { /* ignore */ }
  }

  const canFight = selectedChar && selectedMonster && !fighting && !result;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black" style={{ fontFamily:"'Cinzel',serif", color:"#ffcc00" }}>
          ⚔ Battle
        </h1>
        <button onClick={refresh} disabled={loading} className="text-xs" style={{ color:"#a08040" }}>
          {loading ? "…" : "↺"}
        </button>
      </div>

      {/* Phase selector */}
      <div className="osrs-panel rounded-xl p-3 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily:"'Cinzel',serif", color:"#a08040" }}>Select Phase</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PHASES.map(ph => (
            <button key={ph.id} onClick={() => selectPhase(ph)}
              className="flex-shrink-0 rounded-xl px-3 py-2 text-center transition-all"
              style={{
                background: selectedPhase?.id === ph.id ? ph.bgColor : "rgba(0,0,0,0.3)",
                border: `2px solid ${selectedPhase?.id === ph.id ? ph.color : "rgba(107,79,16,0.4)"}`,
                minWidth: 80,
              }}>
              <p className="text-xs font-black" style={{ fontFamily:"'Cinzel',serif", color: ph.color, fontSize:"0.65rem" }}>{ph.name}</p>
              <p className="text-xs" style={{ color:"#ffe8a0", fontSize:"0.6rem" }}>{ph.location}</p>
              <p className="text-xs" style={{ color: ph.color, fontSize:"0.55rem" }}>{ph.difficulty}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Monster selector */}
      {selectedPhase && (
        <div className="osrs-panel rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily:"'Cinzel',serif", color: selectedPhase.color, fontSize:"0.65rem" }}>
            {selectedPhase.location} — Choose Monster
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {selectedPhase.monsters.map(m => (
              <MonsterCard key={m.id} monster={m} selected={selectedMonster?.id === m.id} onClick={() => selectMonster(m)} />
            ))}
          </div>
          {selectedMonster && (
            <div className="rounded-xl p-2 text-xs space-y-1" style={{ background:"rgba(0,0,0,0.3)", border:"1px solid #3d2a00" }}>
              <p style={{ color:"#ffe8a0" }}>
                <strong>{selectedMonster.name}</strong> — Weak to <strong style={{ color: selectedMonster.weakness==="ranged"?"#fbbf24":selectedMonster.weakness==="magic"?"#c084fc":"#ef4444" }}>{selectedMonster.weakness}</strong>
              </p>
              <p style={{ color:"#a08040" }}>Reward: <strong style={{ color:"#ffcc00" }}>{selectedMonster.tokenReward.toLocaleString()} gp</strong></p>
            </div>
          )}
        </div>
      )}

      {/* Fighter selector */}
      {selectedMonster && (
        <div className="osrs-panel rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily:"'Cinzel',serif", color:"#a08040" }}>Choose Fighter</p>
          {fighters.length === 0 ? (
            <p className="text-sm" style={{ color:"#6b7280" }}>No idle fighters. Unstake a character from Dungeon first.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {fighters.map(c => (
                <CharCard key={c.id} char={c} selected={selectedChar?.id === c.id} onClick={() => selectChar(c)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fight button */}
      {selectedChar && selectedMonster && !result && (
        <button onClick={fight} disabled={!canFight || fighting}
          className={fighting ? "w-full py-4 rounded-xl font-black text-base" : "osrs-btn-green w-full py-4 text-base"}
          style={fighting ? { background:"rgba(107,114,128,0.3)", border:"1px solid rgba(107,114,128,0.4)", color:"#6b7280", cursor:"not-allowed" } : {}}>
          {fighting
            ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⚔</span> Fighting…</span>
            : `⚔ Fight ${selectedMonster.name}!`}
        </button>
      )}

      {/* Battle result */}
      {result && selectedMonster && selectedChar && (
        <div className="rounded-2xl overflow-hidden animate-bounce-in"
             style={{ border:`2px solid ${result.win ? "#6dde6d" : "#ef4444"}`, background: result.win ? "rgba(109,222,109,0.08)" : "rgba(239,68,68,0.08)" }}>
          {/* VS header */}
          <div className="flex items-center justify-between px-4 py-3"
               style={{ borderBottom:`1px solid ${result.win?"rgba(109,222,109,0.2)":"rgba(239,68,68,0.2)"}`, background:"rgba(0,0,0,0.3)" }}>
            <div className="flex items-center gap-2">
              <OsrsSprite srcs={CHAR_SPRITES[selectedChar.class_type]?.[selectedChar.rarity]??[]} fallback={selectedChar.emoji} size={40} />
              <div>
                <p className="text-xs font-black capitalize" style={{ fontFamily:"'Cinzel',serif", color:"#ffe8a0" }}>{selectedChar.class_type}</p>
                <p className="text-xs" style={{ color: result.win ? "#6dde6d" : "#f87171" }}>
                  {result.win ? `${result.charHp} HP left` : "Defeated"}
                </p>
              </div>
            </div>
            <span className="text-2xl font-black animate-vs-pulse" style={{ color: result.win?"#6dde6d":"#ef4444" }}>
              {result.win ? "WIN!" : "LOSS"}
            </span>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs font-black" style={{ fontFamily:"'Cinzel',serif", color:"#ffe8a0" }}>{selectedMonster.name}</p>
                <p className="text-xs" style={{ color:"#f87171" }}>{result.win ? "Defeated" : "Survived"}</p>
              </div>
              <OsrsSprite srcs={selectedMonster.sprite} fallback="👾" size={40} />
            </div>
          </div>

          {/* Battle log */}
          <div className="px-4 py-3 space-y-1">
            {result.log.map((line, i) => (
              <p key={i} className="text-xs" style={{ color: line.startsWith("🏆")?"#6dde6d":line.startsWith("💀")?"#f87171":"#a08040" }}>{line}</p>
            ))}
          </div>

          {/* Reward / retry */}
          <div className="px-4 pb-4 flex gap-2">
            {result.win && !rewardClaimed && (
              <button onClick={claimReward} className="osrs-btn-green flex-1 text-sm">
                💰 Claim {selectedMonster.tokenReward.toLocaleString()} gp
              </button>
            )}
            {rewardClaimed && (
              <p className="flex-1 text-center text-sm font-black" style={{ color:"#6dde6d" }}>
                +{selectedMonster.tokenReward.toLocaleString()} gp claimed!
              </p>
            )}
            <button onClick={() => { setResult(null); setRewardClaimed(false); }} className="osrs-btn flex-1 text-sm">
              ↺ Fight Again
            </button>
          </div>
        </div>
      )}

      {/* Tip */}
      {!selectedPhase && (
        <div className="osrs-panel rounded-xl p-4 text-xs space-y-1" style={{ color:"#a08040" }}>
          <p className="font-bold" style={{ fontFamily:"'Cinzel',serif", color:"#ffcc00", fontSize:"0.65rem" }}>How Battle works</p>
          <p>• Pick a phase, a monster, and an idle fighter</p>
          <p>• Class type beats monster weakness: <strong style={{ color:"#ffe8a0" }}>Warrior→Mage→Archer→Warrior</strong></p>
          <p>• Winning grants gold rewards. No energy cost — fight as much as you want!</p>
          <p>• Stats (Attack, Defense, HP…) determine outcome — rarer characters are stronger</p>
          <p>• Staked characters <strong style={{ color:"#ffe8a0" }}>cannot</strong> fight. Unstake first.</p>
        </div>
      )}
    </div>
  );
}
