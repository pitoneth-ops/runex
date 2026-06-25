import { useEffect, useCallback, useState } from "react";
import { useGameStore } from "../store";
import { getPlayer } from "../api";
import { OsrsSprite } from "../components/OsrsSprite";
import { SKILL_ICONS, SKILL_CAPE_SPRITES } from "../sprites";

const SKILLS_META = [
  { key: "attack",    name: "Attack",    fallback: "⚔️",  classType: "warrior", tip: "1 warrior staked = +1 lvl/day"  },
  { key: "hitpoints", name: "Hitpoints", fallback: "❤️",  classType: null,      tip: "All staked chars = +1 lvl/day"  },
  { key: "mining",    name: "Mining",    fallback: "⛏️",  classType: "miner",   tip: "1 miner staked = +1 lvl/day"    },
  { key: "magic",     name: "Magic",     fallback: "🔮",  classType: "mage",    tip: "1 mage staked = +1 lvl/day"     },
  { key: "ranged",    name: "Ranged",    fallback: "🏹",  classType: "archer",  tip: "1 archer staked = +1 lvl/day"   },
] as const;

type SkillKey = "attack" | "hitpoints" | "mining" | "magic" | "ranged";

const CAPE_STAT_LABEL: Record<SkillKey, string> = {
  attack:    "+12 ATK · +3 Vit",
  ranged:    "+12 Destreza · +3 Vit",
  magic:     "+12 Magia · +3 Vit",
  mining:    "+10 Vit · +3 ATK",
  hitpoints: "+18 Vit · +3 ATK",
};

function lvl(v: number) { return Math.min(99, Math.floor(v)); }
function pct(v: number) { return ((v % 1) * 100).toFixed(0); }

const BAR_COLOR: Record<SkillKey, string> = {
  attack:    "#ef4444",
  hitpoints: "#ef4444",
  mining:    "#9ca3af",
  magic:     "#c084fc",
  ranged:    "#60a5fa",
};

export default function Skills() {
  const { wallet, player, setPlayer } = useGameStore();
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try { const p = await getPlayer(wallet); setPlayer(p); }
    finally { setLoading(false); }
  }, [wallet, setPlayer]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!wallet) return <p className="text-center py-20" style={{ color: "#a08040" }}>Connect wallet first.</p>;

  const skills        = player?.skills;
  const pendingSkills = player?.pending_skills;
  const inventory     = player?.inventory ?? [];

  const totalLevel = skills ? SKILLS_META.reduce((s, m) => s + lvl(skills[m.key]), 0) : 0;
  const maxTotal   = SKILLS_META.length * 99;

  // Which skill capes the player already owns (in inventory)
  const ownedCapes = new Set(
    inventory
      .filter(i => i.item_slot === "cape" && i.item_name?.endsWith(" Cape"))
      .map(i => i.item_name?.replace(" Cape", "").toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00" }}>
          📊 Skills
        </h1>
        <button onClick={refresh} disabled={loading} className="text-xs transition-colors" style={{ color: "#a08040" }}>
          {loading ? "…" : "↺ Refresh"}
        </button>
      </div>

      {/* Total level */}
      <div className="osrs-panel rounded-xl px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest" style={{ fontFamily: "'Cinzel',serif", color: "#a08040" }}>Total Level</p>
          <p className="text-3xl font-black" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00" }}>{totalLevel}</p>
          <p className="text-xs" style={{ color: "#6b4f10" }}>/ {maxTotal}</p>
        </div>
        <div className="text-right text-xs" style={{ color: "#a08040" }}>
          <p>Level up by staking</p>
          <p>characters in Dungeon</p>
          <p>or Mining</p>
        </div>
      </div>

      {/* Skills grid */}
      <div className="grid grid-cols-3 gap-2">
        {SKILLS_META.map((s) => {
          const raw      = skills?.[s.key] ?? 1;
          const level    = lvl(raw);
          const progPct  = parseFloat(pct(raw));
          const isMax    = level >= 99;
          const hasCape  = ownedCapes.has(s.key);

          const stakedChars = player?.characters?.filter(c => c.is_staked) ?? [];
          const ratePerDay  = s.classType === null
            ? stakedChars.length
            : stakedChars.filter(c => c.class_type === s.classType).length;

          return (
            <button
              key={s.key}
              className="osrs-panel rounded-xl p-2 flex flex-col items-center gap-1 text-center transition-all hover:brightness-110 active:scale-95"
              onClick={() => setTooltip(tooltip === s.key ? null : s.key)}
              style={{
                cursor: "pointer",
                border: isMax ? "1.5px solid rgba(255,204,0,0.5)" : undefined,
                boxShadow: isMax ? "0 0 12px rgba(255,204,0,0.15)" : undefined,
              }}>

              <OsrsSprite srcs={SKILL_ICONS[s.key] ?? []} fallback={s.fallback} size={36} pixelated={false} />

              <p className="text-xs font-bold uppercase tracking-wide" style={{ fontFamily: "'Cinzel',serif", color: "#a08040", fontSize: "0.6rem" }}>
                {s.name}
              </p>

              <p className={`text-base font-black`} style={{ color: isMax ? "#ffcc00" : "#ffe8a0" }}>
                {level}<span className="text-xs" style={{ color: "#6b4f10" }}>/99</span>
              </p>

              {isMax ? (
                <p className="text-xs font-black" style={{ color: "#ffcc00", fontSize: "0.6rem", letterSpacing: "0.05em" }}>
                  ✦ MAX ✦
                </p>
              ) : (
                <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "rgba(0,0,0,0.5)", border: "1px solid #3d2a00" }}>
                  <div style={{
                    width: `${progPct}%`, height: "100%",
                    background: BAR_COLOR[s.key as SkillKey],
                    borderRadius: "99px", transition: "width 0.4s ease",
                  }} />
                </div>
              )}

              {/* Cape indicator */}
              {hasCape && (
                <div style={{ fontSize: "0.55rem", color: "#ffcc00" }}>🏅 Cape</div>
              )}

              {ratePerDay > 0 && !isMax && (
                <p className="text-xs font-bold" style={{ color: "#6dde6d", fontSize: "0.6rem" }}>
                  +{ratePerDay} lvl/day
                </p>
              )}
            </button>
          );
        })}

        {/* Total cell */}
        <div className="osrs-panel rounded-xl p-2 flex flex-col items-center gap-1 text-center" style={{ opacity: 0.7 }}>
          <span style={{ fontSize: 30, lineHeight: 1 }}>🏆</span>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ fontFamily: "'Cinzel',serif", color: "#a08040", fontSize: "0.6rem" }}>Total</p>
          <p className="text-base font-black" style={{ color: "#ffcc00" }}>
            {totalLevel}<span className="text-xs" style={{ color: "#6b4f10" }}>/{maxTotal}</span>
          </p>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="osrs-panel rounded-xl p-4 text-center">
          {(() => {
            const meta    = SKILLS_META.find(s => s.key === tooltip)!;
            const raw     = skills?.[meta.key] ?? 1;
            const level   = lvl(raw);
            const isMax   = level >= 99;
            const hasCape = ownedCapes.has(meta.key);
            const staked  = player?.characters?.filter(c => c.is_staked) ?? [];
            const rate    = meta.classType === null ? staked.length : staked.filter(c => c.class_type === meta.classType).length;

            return (
              <>
                <p className="font-black" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00" }}>{meta.name}</p>
                <p className="text-sm mt-1" style={{ color: "#a08040" }}>{meta.tip}</p>
                <p className="text-lg font-black mt-2" style={{ color: isMax ? "#ffcc00" : "#ffe8a0" }}>
                  Level {level} / 99 {isMax && "✦"}
                </p>
                {rate > 0 && !isMax && (
                  <p className="text-sm mt-1" style={{ color: "#6dde6d" }}>
                    Currently earning +{rate} level{rate !== 1 ? "s" : ""}/day
                  </p>
                )}
                {rate === 0 && !isMax && (
                  <p className="text-sm mt-1" style={{ color: "#6b7280" }}>No characters staked for this skill</p>
                )}

                {/* Level 99 Cape reward */}
                <div className="mt-3 rounded-xl p-3"
                     style={{ background: hasCape ? "rgba(255,204,0,0.08)" : "rgba(0,0,0,0.2)", border: hasCape ? "1px solid rgba(255,204,0,0.3)" : "1px solid rgba(107,79,16,0.3)" }}>
                  <p className="text-xs font-bold mb-2" style={{ color: hasCape ? "#ffcc00" : "#6b4f10", fontFamily: "'Cinzel',serif" }}>
                    {hasCape ? "✦ Skill Cape Earned" : "Level 99 Reward"}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <OsrsSprite srcs={SKILL_CAPE_SPRITES[meta.key] ?? []} fallback="🧣" size={hasCape ? 52 : 40} pixelated={false}
                      style={{ opacity: hasCape ? 1 : 0.35, filter: hasCape ? "drop-shadow(0 0 8px rgba(255,204,0,0.5))" : "grayscale(1)" }} />
                    <div className="text-left">
                      <p className="text-xs font-bold" style={{ color: hasCape ? "#ffcc00" : "#6b4f10", fontFamily: "'Cinzel',serif" }}>
                        {meta.name} Cape
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: hasCape ? "#a08040" : "#4a3820" }}>
                        {CAPE_STAT_LABEL[meta.key as SkillKey]}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: hasCape ? "#a855f7" : "#4a3820" }}>Legendary · Cape slot</p>
                      {!hasCape && (
                        <p className="text-xs mt-1" style={{ color: "#6b7280" }}>Reach level 99 to unlock</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Earned capes showcase */}
      {ownedCapes.size > 0 && (
        <div className="osrs-panel rounded-xl p-4">
          <p className="text-sm font-black mb-3" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00" }}>
            ✦ Skill Capes Earned
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {SKILLS_META.filter(s => ownedCapes.has(s.key)).map(s => (
              <div key={s.key} className="flex flex-col items-center gap-1">
                <OsrsSprite
                  srcs={SKILL_CAPE_SPRITES[s.key] ?? []}
                  fallback="🧣"
                  size={44}
                  pixelated={false}
                  style={{ filter: "drop-shadow(0 0 6px rgba(255,204,0,0.5))" }}
                />
                <p className="text-xs font-bold" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "0.6rem" }}>
                  {s.name}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-center mt-2" style={{ color: "#6b4f10" }}>
            Equip your capes in the Equip tab — they are legendary cape-slot items.
          </p>
        </div>
      )}

      {/* How it works */}
      <div className="osrs-panel rounded-xl p-4 space-y-1 text-xs" style={{ color: "#a08040" }}>
        <p className="font-bold uppercase tracking-wider" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "0.65rem" }}>How skills work</p>
        <p>• 1 character staked for 1 day = <strong style={{ color: "#ffe8a0" }}>+1 level</strong></p>
        <p>• 5 warriors staked for 1 day = <strong style={{ color: "#ffe8a0" }}>+5 Attack</strong></p>
        <p>• 1 warrior staked for 99 days = <strong style={{ color: "#ffe8a0" }}>Level 99</strong></p>
        <p>• Hitpoints counts <strong style={{ color: "#ffe8a0" }}>all</strong> staked characters</p>
        <p>• Reach Level 99 → earn a <strong style={{ color: "#ffcc00" }}>Skill Cape (Legendary)</strong></p>
        <p>• Claim/Unstake to bank your skill progress</p>
      </div>
    </div>
  );
}
