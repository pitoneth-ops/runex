import { useState } from "react";
import { OsrsSprite } from "../components/OsrsSprite";
import { SKILL_ICONS, SKILL_CAPE_SPRITES, RUNEX_ICON, GAME_ICONS, EQUIP_ITEM_SPRITES, ARMOR_ICONS } from "../sprites";

const W = "https://oldschool.runescape.wiki/w/Special:FilePath";

type Tab = "herox" | "skills" | "items" | "economy" | "royale" | "currencies";

const PHASES = [
  { n: 1, name: "Goblin Chieftain", weak: "Berserker", wColor: "#ef4444", runex: "500",     drop: "3%",  sprite: [`${W}/Goblin_chathead.png`] },
  { n: 2, name: "Ice Queen",        weak: "Ranger",    wColor: "#60a5fa", runex: "2,000",   drop: "5%",  sprite: [`${W}/Ice_warrior_chathead.png`] },
  { n: 3, name: "Chaos Wizard",     weak: "Paladin",   wColor: "#22c55e", runex: "8,000",   drop: "8%",  sprite: [`${W}/Dark_wizard_chathead.png`] },
  { n: 4, name: "Blue Dragon",      weak: "Sorcerer",  wColor: "#a855f7", runex: "35,000",  drop: "12%", sprite: [`${W}/Blue_dragon_chathead.png`] },
  { n: 5, name: "Zulrah",           weak: "Ranger",    wColor: "#60a5fa", runex: "100,000", drop: "20%", sprite: [`${W}/Zulrah.png`] },
];

const CLASSES = [
  { name: "Berserker", emoji: "⚔",  primary: "Attack",  color: "#ef4444", desc: "High ATK & HP · Melee fighter", sprite: [`${W}/Man_chathead.png`] },
  { name: "Ranger",    emoji: "🏹", primary: "Ranged",  color: "#60a5fa", desc: "High Speed & Ranged · Kites enemies", sprite: [`${W}/Ranger_chathead.png`] },
  { name: "Sorcerer",  emoji: "🔮", primary: "Magic",   color: "#a855f7", desc: "High Magic · Destroys dragons", sprite: [`${W}/Wizard_chathead.png`] },
  { name: "Paladin",   emoji: "🛡", primary: "Defense", color: "#22c55e", desc: "High HP & DEF · Tanks everything", sprite: [`${W}/Monk_chathead.png`] },
];

const RARITIES = [
  { name: "Common",    mult: "×1.0",  chance: "50%", color: "#a0a0a0" },
  { name: "Rare",      mult: "×1.3",  chance: "30%", color: "#4a90ff" },
  { name: "Epic",      mult: "×1.65", chance: "15%", color: "#a855f7" },
  { name: "Legendary", mult: "×2.2",  chance: "5%",  color: "#ffcc00" },
];

const SKILLS_DATA = [
  { key: "attack",    name: "Attack",    emoji: "⚔",  cls: "Warriors",  clsColor: "#ef4444", sprite: [`${W}/Attack_icon_(detail).png`], cape: "Attack Cape",    capeStat: "+12 ATK · +3 Vit" },
  { key: "ranged",    name: "Ranged",    emoji: "🏹", cls: "Archers",   clsColor: "#60a5fa", sprite: [`${W}/Ranged_icon_(detail).png`], cape: "Ranged Cape",    capeStat: "+12 Destreza · +3 Vit" },
  { key: "magic",     name: "Magic",     emoji: "🔮", cls: "Mages",     clsColor: "#a855f7", sprite: [`${W}/Magic_icon_(detail).png`],  cape: "Magic Cape",     capeStat: "+12 Magia · +3 Vit" },
  { key: "mining",    name: "Mining",    emoji: "⛏",  cls: "Miners",    clsColor: "#9ca3af", sprite: [`${W}/Mining_icon_(detail).png`], cape: "Mining Cape",    capeStat: "+10 Vit · +3 ATK" },
  { key: "hitpoints", name: "Hitpoints", emoji: "❤",  cls: "Everyone",  clsColor: "#fbbf24", sprite: [`${W}/Hitpoints_icon_(detail).png`], cape: "Hitpoints Cape", capeStat: "+18 Vit · +3 ATK" },
];

const ITEM_TYPES = [
  { emoji: "🗡", name: "Equipment",      desc: "Wearable gear with stat bonuses. Each piece has a slot and a rarity that determines power." },
  { emoji: "🪨", name: "Upgrade Stone",  desc: "Dropped by miners during mining runs. Used to evolve a miner to the next rarity tier." },
  { emoji: "❤", name: "Vitality Potion", desc: "Boosts a staked character's HP pool, helping them survive dungeon runs longer." },
  { emoji: "💰", name: "Token Boost",    desc: "Multiplies Gold earned per day by a staked character." },
  { emoji: "🍀", name: "Drop Boost",     desc: "Increases item drop chance when claiming or unstaking. Stack multiple for best effect." },
];

const EQUIP_SLOTS = [
  { emoji: "⛑",  name: "Head",   stat: "Vitalidade",    srcs: EQUIP_ITEM_SPRITES.head?.legendary   ?? [] },
  { emoji: "📿", name: "Neck",   stat: "Vit / Magia",   srcs: EQUIP_ITEM_SPRITES.neck?.legendary   ?? [] },
  { emoji: "🧣", name: "Cape",   stat: "Vit / Destreza",srcs: EQUIP_ITEM_SPRITES.cape?.legendary   ?? [] },
  { emoji: "⚔",  name: "Weapon", stat: "ATK/Dest/Magia",srcs: EQUIP_ITEM_SPRITES.weapon_atk?.legendary ?? [] },
  { emoji: "🦺", name: "Body",   stat: "Vitalidade",    srcs: EQUIP_ITEM_SPRITES.body?.legendary   ?? [] },
  { emoji: "🛡", name: "Shield", stat: "Vitalidade",    srcs: EQUIP_ITEM_SPRITES.shield?.legendary  ?? [] },
  { emoji: "👖", name: "Legs",   stat: "Vitalidade",    srcs: EQUIP_ITEM_SPRITES.legs?.legendary   ?? [] },
  { emoji: "🧤", name: "Hands",  stat: "ATK/Dest/Magia",srcs: EQUIP_ITEM_SPRITES.hands?.legendary  ?? [] },
  { emoji: "👟", name: "Feet",   stat: "Vit / Destreza",srcs: EQUIP_ITEM_SPRITES.feet?.legendary   ?? [] },
  { emoji: "💍", name: "Ring",   stat: "Any stat",      srcs: EQUIP_ITEM_SPRITES.ring?.legendary   ?? [] },
];

const panel = { background: "rgba(15,8,0,0.85)", border: "1px solid #6b4f10", borderRadius: 10, padding: "12px" } as const;
const sectionTitle = { fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "0.85rem", fontWeight: 900, borderBottom: "1px solid #6b4f10", paddingBottom: 5, marginBottom: 12 } as const;
const bodyText     = { color: "#a08040", fontSize: "0.75rem", lineHeight: 1.75 } as const;

function FlowStep({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <div className="flex-1 rounded-xl text-center" style={{ ...panel, minWidth: 70, padding: "10px 6px" }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "0.65rem", fontWeight: 700, marginTop: 4 }}>{label}</p>
      <p style={{ color: "#6b4f10", fontSize: "0.6rem", marginTop: 2 }}>{sub}</p>
    </div>
  );
}

function FlowArrow() {
  return <span style={{ color: "#6b4f10", fontSize: 18, flexShrink: 0 }}>→</span>;
}

export default function Wiki() {
  const [tab, setTab] = useState<Tab>("herox");

  const tabs: { id: Tab; label: string }[] = [
    { id: "herox",      label: "⚔ HeroX"    },
    { id: "skills",     label: "📊 Skills"   },
    { id: "items",      label: "🛡 Items"    },
    { id: "economy",    label: "💰 Economy"  },
    { id: "royale",     label: "👑 Royale"   },
    { id: "currencies", label: "💎 Moedas"   },
  ];

  return (
    <div style={{ background: "#080400", minHeight: "80vh", borderRadius: 12, overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: "#120800", borderBottom: "2px solid #6b4f10", padding: "14px 20px", textAlign: "center" }}>
        <p style={{ fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: "1.3rem", color: "#ffcc00", letterSpacing: "0.06em" }}>
          ⚔ RuneX Wiki
        </p>
        <p style={{ color: "#6b4f10", fontSize: "0.7rem", marginTop: 3 }}>Complete Game Guide</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #6b4f10", background: "#0a0500", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, minWidth: 70, padding: "9px 8px", border: "none", cursor: "pointer",
              fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.03em", whiteSpace: "nowrap",
              color: tab === t.id ? "#ffcc00" : "#7a5820",
              borderBottom: tab === t.id ? "2px solid #ffcc00" : "2px solid transparent",
              background: tab === t.id ? "rgba(255,204,0,0.04)" : "transparent",
              transition: "all 0.12s",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 18 }}>

        {/* ── HEROX TAB ── */}
        {tab === "herox" && (
          <div className="space-y-5">
            <div>
              <p style={sectionTitle}>What is HeroX?</p>
              <p style={bodyText}>HeroX are powerful combat heroes you mint with Gold. Each hero has a class and rarity that determine their stats. Send them to battle monsters across 5 phases to earn <strong style={{ color: "#fca5a5" }}>wRuneX</strong> — and possibly drop equipment items.</p>
              <div className="flex items-center gap-2 flex-wrap mt-3">
                <FlowStep icon="💰" label="Spend Gold" sub="100,000 Gold" />
                <FlowArrow />
                <FlowStep icon="🎲" label="Random Hero" sub="Class + Rarity" />
                <FlowArrow />
                <FlowStep icon="⚔" label="Battle Phases" sub="Up to 5" />
                <FlowArrow />
                <FlowStep icon="💎" label="Earn wRuneX" sub="Per phase" />
              </div>
            </div>

            <div>
              <p style={sectionTitle}>Hero Classes</p>
              <div className="grid grid-cols-2 gap-2">
                {CLASSES.map(c => (
                  <div key={c.name} style={{ ...panel, display: "flex", alignItems: "center", gap: 10 }}>
                    <OsrsSprite srcs={c.sprite} fallback={c.emoji} size={40} pixelated={false} />
                    <div>
                      <p style={{ fontFamily: "'Cinzel',serif", color: c.color, fontWeight: 700, fontSize: "0.8rem" }}>{c.name}</p>
                      <p style={{ color: "#7a5820", fontSize: "0.65rem", marginTop: 2 }}>{c.desc}</p>
                      <p style={{ color: c.color, fontSize: "0.6rem", marginTop: 2, opacity: 0.8 }}>Primary: {c.primary}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p style={sectionTitle}>Rarities & Stat Multipliers</p>
              <div className="grid grid-cols-4 gap-2">
                {RARITIES.map(r => (
                  <div key={r.name} style={{ ...panel, textAlign: "center", border: `1px solid ${r.color}40` }}>
                    <p style={{ fontFamily: "'Cinzel',serif", color: r.color, fontWeight: 700, fontSize: "0.72rem" }}>{r.name}</p>
                    <p style={{ color: r.color, fontSize: "1rem", fontWeight: 900, margin: "4px 0" }}>{r.mult}</p>
                    <p style={{ color: "#6b4f10", fontSize: "0.6rem" }}>{r.chance} chance</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p style={sectionTitle}>Battle Phases</p>
              <p style={{ ...bodyText, marginBottom: 8 }}>Your hero fights through phases in order. Losing a phase stops the run. RuneX accumulates — completing all 5 earns the full total. Using the monster's weakness class gives ×1.5 attack bonus.</p>
              <div style={{ ...panel, padding: 0, overflow: "hidden" }}>
                {PHASES.map((ph, i) => (
                  <div key={ph.n} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                    borderBottom: i < PHASES.length - 1 ? "1px solid rgba(107,79,16,0.3)" : "none",
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 900, fontSize: "0.7rem", color: "#ffcc00", background: "rgba(255,204,0,0.1)", border: "1px solid rgba(255,204,0,0.3)"
                    }}>{ph.n}</div>
                    <OsrsSprite srcs={ph.sprite} fallback="👾" size={32} pixelated={false} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "'Cinzel',serif", color: "#ffe8a0", fontWeight: 700, fontSize: "0.75rem" }}>{ph.name}</p>
                      <p style={{ color: "#6b4f10", fontSize: "0.62rem" }}>
                        Weak to <span style={{ color: ph.wColor, fontWeight: 700 }}>{ph.weak}</span>
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: "#ff6060", fontWeight: 700, fontSize: "0.75rem" }}>+{ph.runex}</p>
                      <p style={{ color: "#6b4f10", fontSize: "0.6rem" }}>wRuneX · {ph.drop} item</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, ...panel, background: "rgba(255,204,0,0.04)", border: "1px solid rgba(255,204,0,0.2)", fontSize: "0.7rem", color: "#a08040", lineHeight: 1.65 }}>
                <strong style={{ color: "#ffcc00" }}>Type advantage:</strong> matching class → ×1.5 ATK. Wrong class → ×0.8 penalty. Items equipped on your hero improve their base stats before combat.
              </div>
            </div>
          </div>
        )}

        {/* ── SKILLS TAB ── */}
        {tab === "skills" && (
          <div className="space-y-5">
            <div>
              <p style={sectionTitle}>How Skills Work</p>
              <p style={bodyText}>Each character class you stake contributes to a specific skill. Skills accumulate in real-time — the longer and more characters you keep staked, the faster they level. You must <strong style={{ color: "#ffe8a0" }}>Claim or Unstake</strong> to bank the pending progress.</p>
              <div className="flex items-center gap-2 flex-wrap mt-3">
                <FlowStep icon="🧍" label="Stake Chars" sub="Dungeon / Mine" />
                <FlowArrow />
                <FlowStep icon="⏱" label="Time Passes" sub="+1 lvl/day/char" />
                <FlowArrow />
                <FlowStep icon="📊" label="Claim/Unstake" sub="Banks XP" />
                <FlowArrow />
                <FlowStep icon="🏅" label="Level Up" sub="Max 99" />
              </div>
            </div>

            <div>
              <p style={sectionTitle}>Skills & Classes</p>
              {SKILLS_DATA.map(s => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(107,79,16,0.25)" }}>
                  <OsrsSprite srcs={SKILL_ICONS[s.key as keyof typeof SKILL_ICONS] ?? []} fallback={s.emoji} size={36} pixelated={false} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontWeight: 700, fontSize: "0.82rem" }}>{s.name}</p>
                    <p style={{ color: "#7a5820", fontSize: "0.68rem", marginTop: 2 }}>
                      Fed by <span style={{ color: s.clsColor, fontWeight: 700 }}>{s.cls}</span> staked — +1 level/day each
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <OsrsSprite srcs={SKILL_CAPE_SPRITES[s.key] ?? []} fallback="🧣" size={28} pixelated={false} />
                    <p style={{ color: "#6b4f10", fontSize: "0.55rem", marginTop: 2 }}>Lvl 99 cape</p>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <p style={sectionTitle}>Level 99 Skill Capes</p>
              <p style={{ ...bodyText, marginBottom: 10 }}>Reaching level 99 in any skill automatically unlocks a <strong style={{ color: "#ffcc00" }}>Legendary Skill Cape</strong> in your inventory. These are by far the strongest cape-slot items in the game — equip them on your characters or heroes for massive stat boosts.</p>
              <div className="grid grid-cols-1 gap-2">
                {SKILLS_DATA.map(s => (
                  <div key={s.key} style={{ ...panel, display: "flex", alignItems: "center", gap: 12, border: "1px solid rgba(255,204,0,0.15)" }}>
                    <OsrsSprite srcs={SKILL_CAPE_SPRITES[s.key] ?? []} fallback="🧣" size={44} pixelated={false} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontWeight: 700, fontSize: "0.8rem" }}>{s.cape}</p>
                      <p style={{ color: "#a855f7", fontSize: "0.65rem" }}>Legendary · Cape slot</p>
                    </div>
                    <p style={{ color: "#a08040", fontSize: "0.7rem", fontWeight: 700 }}>{s.capeStat}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...panel, fontSize: "0.72rem", color: "#a08040", lineHeight: 1.7 }}>
              <strong style={{ color: "#ffcc00" }}>Progression examples:</strong><br />
              • 1 warrior staked → +1 Attack/day → Level 99 in 99 days<br />
              • 3 warriors → +3 Attack/day → Level 99 in 33 days<br />
              • 3 chars of each type → all skills level simultaneously
            </div>
          </div>
        )}

        {/* ── ITEMS TAB ── */}
        {tab === "items" && (
          <div className="space-y-5">
            <div>
              <p style={sectionTitle}>Item Types</p>
              {ITEM_TYPES.map(t => (
                <div key={t.name} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid rgba(107,79,16,0.2)" }}>
                  <span style={{ fontSize: 26, flexShrink: 0, width: 34, textAlign: "center" }}>{t.emoji}</span>
                  <div>
                    <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontWeight: 700, fontSize: "0.8rem" }}>{t.name}</p>
                    <p style={{ color: "#a08040", fontSize: "0.7rem", marginTop: 3, lineHeight: 1.5 }}>{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <p style={sectionTitle}>Equipment Rarities</p>
              <div style={{ ...panel, padding: 0, overflow: "hidden" }}>
                {[
                  { name: "Common",    color: "#a0a0a0", stat: "+1 per stat", battlePct: "78%", chestPct: "88%", sprites: { head: ARMOR_ICONS.warrior?.common } },
                  { name: "Rare",      color: "#4a90ff", stat: "+2 per stat", battlePct: "16%", chestPct: "10%", sprites: { head: ARMOR_ICONS.warrior?.rare   } },
                  { name: "Epic",      color: "#a855f7", stat: "+3 per stat", battlePct: "5%",  chestPct: "1.5%",sprites: { head: ARMOR_ICONS.warrior?.epic   } },
                  { name: "Legendary", color: "#ffcc00", stat: "+4 per stat", battlePct: "1%",  chestPct: "0.5%",sprites: { head: ARMOR_ICONS.warrior?.legendary}},
                ].map((r, i, arr) => (
                  <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: i < arr.length-1 ? "1px solid rgba(107,79,16,0.3)" : "none" }}>
                    <OsrsSprite srcs={[r.sprites.head ?? ""]} fallback="🪖" size={32} pixelated={false} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "'Cinzel',serif", color: r.color, fontWeight: 700, fontSize: "0.8rem" }}>{r.name}</p>
                      <p style={{ color: "#7a5820", fontSize: "0.65rem" }}>{r.stat}</p>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "0.65rem", color: "#7a5820" }}>
                      <p>Battle: {r.battlePct}</p>
                      <p>Chest: {r.chestPct}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p style={sectionTitle}>Equipment Slots (10 total)</p>
              <div className="grid grid-cols-2 gap-2">
                {EQUIP_SLOTS.map(sl => (
                  <div key={sl.name} style={{ ...panel, display: "flex", alignItems: "center", gap: 8 }}>
                    <OsrsSprite srcs={sl.srcs} fallback={sl.emoji} size={28} pixelated={false} />
                    <div>
                      <p style={{ fontFamily: "'Cinzel',serif", color: "#ffe8a0", fontWeight: 700, fontSize: "0.72rem" }}>{sl.name}</p>
                      <p style={{ color: "#6b4f10", fontSize: "0.6rem" }}>{sl.stat}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p style={sectionTitle}>How to Get Items</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { emoji: "📦", title: "Claim / Unstake", desc: "Random drop when collecting staked rewards. Drop Boost items increase the chance." },
                  { emoji: "⚔",  title: "HeroX Battle",   desc: "Each phase has a 3–20% item drop chance. Phase 5 has the highest chance." },
                  { emoji: "🗃",  title: "Item Chest",      desc: "8,000 Gold → 5% item drop chance. Rarity weights are harder than battle drops." },
                ].map(s => (
                  <div key={s.title} style={{ ...panel, textAlign: "center" }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{s.emoji}</div>
                    <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontWeight: 700, fontSize: "0.65rem", marginBottom: 4 }}>{s.title}</p>
                    <p style={{ color: "#6b4f10", fontSize: "0.6rem", lineHeight: 1.5 }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p style={sectionTitle}>⛏ Miner Upgrade System</p>
              <p style={{ ...bodyText, marginBottom: 10 }}>
                Miners have a chance to drop <strong style={{ color: "#fbbf24" }}>Upgrade Stones</strong> while mining — the same drop rate as dungeon item drops. Collect enough stones to evolve your miner to the next rarity tier, permanently increasing its daily Gold output.
              </p>
              <div style={{ ...panel, padding: 0, overflow: "hidden" }}>
                {[
                  { from: "Common",  to: "Rare",      stones: 1, fromColor: "#9ca3af", toColor: "#60a5fa", gpFrom: "12k", gpTo: "17k" },
                  { from: "Rare",    to: "Epic",      stones: 2, fromColor: "#60a5fa", toColor: "#c084fc", gpFrom: "17k", gpTo: "23k" },
                  { from: "Epic",    to: "Legendary", stones: 5, fromColor: "#c084fc", toColor: "#fbbf24", gpFrom: "23k", gpTo: "30k" },
                ].map((r, i, arr) => (
                  <div key={r.from} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < arr.length-1 ? "1px solid rgba(107,79,16,0.3)" : "none" }}>
                    <span style={{ color: r.fromColor, fontWeight: 700, fontFamily: "'Cinzel',serif", fontSize: "0.72rem", minWidth: 55 }}>{r.from}</span>
                    <span style={{ color: "#6b4f10", fontSize: 14 }}>→</span>
                    <span style={{ color: r.toColor, fontWeight: 700, fontFamily: "'Cinzel',serif", fontSize: "0.72rem", flex: 1 }}>{r.to}</span>
                    <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: "0.7rem" }}>🪨 {r.stones} stone{r.stones > 1 ? "s" : ""}</span>
                    <span style={{ color: "#6dde6d", fontSize: "0.65rem" }}>{r.gpFrom}→{r.gpTo}/day</span>
                  </div>
                ))}
              </div>
              <div style={{ ...panel, marginTop: 8, fontSize: "0.7rem", color: "#a08040", lineHeight: 1.65 }}>
                <strong style={{ color: "#fbbf24" }}>How to upgrade:</strong> Stop the miner (click Stop), then click the <em>Upgrade</em> button on the miner card. Stones are consumed automatically. Legendary is the maximum tier.
              </div>
            </div>

            <div style={{ ...panel, fontSize: "0.72rem", color: "#a08040", lineHeight: 1.7 }}>
              <strong style={{ color: "#ffcc00" }}>Stat guide:</strong> Match equipment to your hero's class — give Berserkers ATK weapons, Rangers Destreza bows, Sorcerers Magia staves. Armor pieces always give Vitalidade — best on Paladins.
            </div>
          </div>
        )}

        {/* ── ROYALE TAB ── */}
        {tab === "royale" && (
          <div className="space-y-5">

            {/* Hero banner */}
            <div style={{
              borderRadius: 12, padding: "18px 16px",
              background: "linear-gradient(160deg,rgba(100,0,0,0.3) 0%,rgba(5,2,0,0.95) 100%)",
              border: "1px solid rgba(139,0,0,0.35)",
            }}>
              <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "1.2rem", fontWeight: 900, letterSpacing: "0.05em", textShadow: "0 0 20px rgba(255,204,0,0.25)" }}>
                ⚔ Battle Royale
              </p>
              <p style={{ ...bodyText, marginTop: 6 }}>
                The ultimate HeroX challenge. Enter with your strongest hero and survive 7 consecutive fights against AI opponents of increasing rarity. One defeat ends the run — but a full clear earns <strong style={{ color: "#ff6060" }}>1,000,000 RuneX</strong>.
              </p>
            </div>

            {/* Requirements */}
            <div>
              <p style={sectionTitle}>Entry Requirements</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: "📊", label: "Hero Level 10", desc: "Earn 100,000 RuneX in HeroX battles to unlock it", col: "#fbbf24" },
                  { icon: "💎", label: "100,000 RuneX",  desc: "Entry fee deducted on entry, not refundable on defeat", col: "#ff6060" },
                ].map(r => (
                  <div key={r.label} style={{ ...panel, border: `1px solid ${r.col}22` }}>
                    <p style={{ fontSize: "1.3rem" }}>{r.icon}</p>
                    <p style={{ fontFamily: "'Cinzel',serif", color: r.col, fontWeight: 700, fontSize: "0.75rem", marginTop: 4 }}>{r.label}</p>
                    <p style={{ color: "#6b4f10", fontSize: "0.62rem", marginTop: 3, lineHeight: 1.5 }}>{r.desc}</p>
                  </div>
                ))}
              </div>
              <div style={{ ...panel, marginTop: 8, fontSize: "0.7rem", color: "#a08040", lineHeight: 1.7 }}>
                <strong style={{ color: "#fbbf24" }}>How to reach Hero Level 10:</strong> A hero's level is derived from their total RuneX earned in HeroX battles. Each 10,000 RuneX earned = 1 level. Level 10 = 100,000 RuneX earned total across all battles.
              </div>
            </div>

            {/* 7-fight structure */}
            <div>
              <p style={sectionTitle}>The 7-Fight Gauntlet</p>
              <p style={{ ...bodyText, marginBottom: 10 }}>Fights are sequential — you cannot skip or rest between them. Your hero's HP carries over between fights. Each opponent is AI-controlled with full stats based on their rarity.</p>
              <div style={{ ...panel, padding: 0, overflow: "hidden" }}>
                {[
                  { range: "Fights 1–2", tier: "Common",    col: "#9ca3af", note: "Warm-up — strong heroes win easily" },
                  { range: "Fights 3–4", tier: "Rare",      col: "#60a5fa", note: "Noticeably tougher — class matchup matters" },
                  { range: "Fights 5–6", tier: "Epic",      col: "#c084fc", note: "High damage, hard to survive without HP" },
                  { range: "Fight 7",    tier: "Legendary", col: "#fbbf24", note: "The final boss tier — best-in-class stats" },
                ].map((row, i, arr) => (
                  <div key={row.range} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                    borderBottom: i < arr.length - 1 ? "1px solid rgba(107,79,16,0.3)" : "none",
                  }}>
                    <div style={{ width: 3, height: 30, borderRadius: 2, background: row.col, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "'Cinzel',serif", color: row.col, fontWeight: 700, fontSize: "0.75rem" }}>{row.range}</p>
                      <p style={{ color: "#6b4f10", fontSize: "0.62rem", marginTop: 2 }}>{row.note}</p>
                    </div>
                    <span style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: "0.62rem", fontWeight: 700,
                      border: `1px solid ${row.col}33`, background: `${row.col}11`, color: row.col,
                    }}>{row.tier}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Combat system */}
            <div>
              <p style={sectionTitle}>Combat System</p>
              <p style={{ ...bodyText, marginBottom: 10 }}>
                Each fight is a turn-by-turn simulation. Both fighters attack simultaneously each round. Stats from your hero (HP, ATK, DEF, Ranged, Magic, Speed) and equipped items all apply. The fight ends when one side reaches 0 HP.
              </p>
              <div style={{ ...panel, fontSize: "0.7rem", color: "#a08040", lineHeight: 1.8 }}>
                <p>⚔ <strong style={{ color: "#ffe8a0" }}>Hit Rate:</strong> Based on your ATK vs opponent DEF — higher attack means more hits per round.</p>
                <p>💥 <strong style={{ color: "#ffe8a0" }}>DPT (Damage per Turn):</strong> Weighted by class stats — Berserkers deal raw ATK damage, Rangers use Ranged, Sorcerers use Magic.</p>
                <p>🛡 <strong style={{ color: "#ffe8a0" }}>Defense:</strong> Reduces incoming damage — high DEF heroes survive longer against Legendary opponents.</p>
                <p>⚡ <strong style={{ color: "#ffe8a0" }}>Speed:</strong> Higher speed heroes act first each round, which matters in close fights.</p>
              </div>
            </div>

            {/* Prizes */}
            <div>
              <p style={sectionTitle}>Prizes</p>
              <div style={{ ...panel, padding: 0, overflow: "hidden" }}>
                {[
                  { result: "Survive Fight 1",  prize: "Entry fee lost",           col: "#ef4444",  note: "No consolation prize" },
                  { result: "Survive Fights 1–6", prize: "Entry fee lost",          col: "#ef4444",  note: "Must win ALL 7 to claim prize" },
                  { result: "Win all 7 fights", prize: "+1,000,000 wRuneX",       col: "#fbbf24",  note: "Prize credited as in-game wRuneX — withdraw via header button" },
                ].map((row, i, arr) => (
                  <div key={row.result} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < arr.length - 1 ? "1px solid rgba(107,79,16,0.3)" : "none" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "'Cinzel',serif", color: "#ffe8a0", fontWeight: 700, fontSize: "0.72rem" }}>{row.result}</p>
                      <p style={{ color: "#6b4f10", fontSize: "0.6rem", marginTop: 2 }}>{row.note}</p>
                    </div>
                    <span style={{ fontWeight: 900, fontSize: "0.72rem", color: row.col, flexShrink: 0 }}>{row.prize}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div style={{ ...panel, fontSize: "0.72rem", color: "#a08040", lineHeight: 1.8 }}>
              <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontWeight: 700, fontSize: "0.75rem", marginBottom: 6 }}>Strategy Tips</p>
              <p>🎯 Equip your hero with the best gear you have — all 10 item slots count.</p>
              <p>❤ Prioritize HP gear for fights 5–7 where Legendary opponents hit hardest.</p>
              <p>⚔ The hero's class does NOT need to match opponents — pure stat power wins.</p>
              <p>🔁 No cooldown — you can re-enter immediately after a loss (if you have 100k RuneX).</p>
              <p>💎 Save wRuneX from multiple HeroX wins before attempting the Royale.</p>
              <p>🔄 Won the Royale? Withdraw your 1M wRuneX via the header button.</p>
            </div>

          </div>
        )}

        {/* ── CURRENCIES TAB ── */}
        {tab === "currencies" && (
          <div className="space-y-5">
            <div>
              <p style={sectionTitle}>RuneX vs wRuneX</p>
              <p style={{ ...bodyText, marginBottom: 12 }}>RuneX has two forms: the real on-chain token and an in-game wrapped version. Understanding the difference is key to managing your balance.</p>
              <div style={{ ...panel, padding: 0, overflow: "hidden" }}>
                {[
                  { label: "RuneX",   sub: "On-chain · Phantom wallet", color: "#ff6060", badge: "Real token",  points: ["Solana SPL Token 2022", "Lives in your Phantom wallet", "Spent to open Mint boxes (50,000)", "Spent to enter Battle Royale (100,000)", "Visible in Phantom as 'RuneX'"] },
                  { label: "wRuneX",  sub: "In-game · earned in RuneX", color: "#fca5a5", badge: "In-game",     points: ["Earned from HeroX battle phases", "Earned from Shop chests (with Gold)", "Won as Battle Royale prize (1,000,000)", "Withdraw → converts to real RuneX on-chain", "Shown as 💎 wRX in the top bar"] },
                ].map((item, i, arr) => (
                  <div key={item.label} style={{ padding: "14px 16px", borderBottom: i < arr.length - 1 ? "1px solid rgba(107,79,16,0.3)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div>
                        <p style={{ fontFamily: "'Cinzel',serif", color: item.color, fontWeight: 900, fontSize: "0.9rem" }}>{item.label}</p>
                        <p style={{ color: "#6b4f10", fontSize: "0.62rem" }}>{item.sub}</p>
                      </div>
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: "0.62rem", fontWeight: 700, border: `1px solid ${item.color}44`, background: `${item.color}11`, color: item.color }}>{item.badge}</span>
                    </div>
                    <ul style={{ color: "#a08040", fontSize: "0.68rem", lineHeight: 1.9, paddingLeft: 14 }}>
                      {item.points.map(p => <li key={p}>• {p}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p style={sectionTitle}>How to Withdraw</p>
              <div className="flex items-center gap-2 flex-wrap">
                <FlowStep icon="⚔" label="Play &amp; Earn" sub="Battles · Chests" />
                <FlowArrow />
                <FlowStep icon="💎" label="Accumulate" sub="wRuneX balance" />
                <FlowArrow />
                <FlowStep icon="🔝" label="Header Button" sub="💎 wRX" />
                <FlowArrow />
                <FlowStep icon="👛" label="Phantom" sub="Real RuneX sent" />
              </div>
              <div style={{ ...panel, fontSize: "0.7rem", color: "#a08040", lineHeight: 1.8, marginTop: 10 }}>
                <p>1. Click the <strong style={{ color: "#fca5a5" }}>💎 wRX</strong> button in the top bar</p>
                <p>2. Enter the amount you want to withdraw (minimum 100 wRuneX)</p>
                <p>3. Click <strong style={{ color: "#4ade80" }}>Swap →</strong> — the treasury sends real RuneX to your Phantom wallet</p>
                <p>4. Your wRuneX balance decreases and RuneX appears in Phantom within seconds</p>
              </div>
            </div>

            <div style={{ ...panel, fontSize: "0.7rem", color: "#a08040", lineHeight: 1.8, border: "1px solid rgba(255,204,0,0.2)", background: "rgba(255,204,0,0.03)" }}>
              <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontWeight: 700, fontSize: "0.75rem", marginBottom: 6 }}>Important Notes</p>
              <p>💳 Minimum withdraw: <strong style={{ color: "#ffe8a0" }}>100 wRuneX</strong></p>
              <p>⏱ Withdrawals are processed on-chain — may take a few seconds to appear in Phantom</p>
              <p>📊 Your on-chain RuneX balance is shown in the Phantom app — check there after withdrawal</p>
              <p>🔒 wRuneX cannot be transferred between players — only withdrawn to your own wallet</p>
            </div>
          </div>
        )}

        {/* ── ECONOMY TAB ── */}
        {tab === "economy" && (
          <div className="space-y-5">
            <div>
              <p style={sectionTitle}>Three Currencies</p>
              <div className="space-y-2">
                <div style={{ ...panel, display: "flex", alignItems: "center", gap: 12, border: "1px solid rgba(255,204,0,0.25)" }}>
                  <OsrsSprite srcs={GAME_ICONS.gold} fallback="🪙" size={36} pixelated={false} />
                  <div>
                    <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontWeight: 700, fontSize: "0.85rem" }}>Gold (gp)</p>
                    <p style={{ color: "#7a5820", fontSize: "0.68rem", marginTop: 2, lineHeight: 1.6 }}>Off-chain. Earned staking characters. Spent on chests, HeroX mint.</p>
                  </div>
                </div>
                <div style={{ ...panel, display: "flex", alignItems: "center", gap: 12, border: "1px solid rgba(255,96,96,0.25)" }}>
                  <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={36} />
                  <div>
                    <p style={{ fontFamily: "'Cinzel',serif", color: "#ff6060", fontWeight: 700, fontSize: "0.85rem" }}>RuneX (on-chain)</p>
                    <p style={{ color: "#7a5820", fontSize: "0.68rem", marginTop: 2, lineHeight: 1.6 }}>Real SPL token on Solana. Lives in Phantom. Spent to open Mint boxes (50k) or enter Battle Royale (100k). Check header for wallet balance.</p>
                  </div>
                </div>
                <div style={{ ...panel, display: "flex", alignItems: "center", gap: 12, border: "1px solid rgba(255,96,96,0.15)", background: "rgba(255,96,96,0.04)" }}>
                  <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={36} />
                  <div>
                    <p style={{ fontFamily: "'Cinzel',serif", color: "#fca5a5", fontWeight: 700, fontSize: "0.85rem" }}>wRuneX (in-game)</p>
                    <p style={{ color: "#7a5820", fontSize: "0.68rem", marginTop: 2, lineHeight: 1.6 }}>Earned in-game from HeroX battles, chests and Battle Royale wins. Withdraw via the <strong style={{ color: "#fca5a5" }}>💎 wRX</strong> button in the top bar → converts to real RuneX sent to your wallet.</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p style={sectionTitle}>Economy Flow</p>
              <div className="flex items-center gap-2 flex-wrap">
                <FlowStep icon="🧍" label="Stake Chars" sub="Earn Gold/day" />
                <FlowArrow />
                <FlowStep icon="🪙" label="Open Chests" sub="Or Mint HeroX" />
                <FlowArrow />
                <FlowStep icon="💎" label="Earn wRuneX" sub="Battles + Chests" />
                <FlowArrow />
                <FlowStep icon="🔄" label="Withdraw" sub="wRX → RuneX" />
              </div>
            </div>

            <div>
              <p style={sectionTitle}>Shop — Chests</p>
              <div style={{ ...panel, padding: 0, overflow: "hidden" }}>
                {[
                  { name: "RuneX Chest",  cost: "5,000 Gold", runex: "100 ~ 10,000 wRuneX", item: "None",            note: "Best wRuneX per Gold on average." },
                  { name: "Item Chest",   cost: "8,000 Gold", runex: "50 ~ 2,000 wRuneX",   item: "5% Equipment Drop", note: "Trade wRuneX range for a gear shot." },
                ].map((c, i) => (
                  <div key={c.name} style={{ padding: "12px 14px", borderBottom: i === 0 ? "1px solid rgba(107,79,16,0.3)" : "none" }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontWeight: 700, fontSize: "0.8rem" }}>{c.name}</p>
                        <p style={{ color: "#ffcc00", fontSize: "0.7rem", marginTop: 2 }}>Cost: {c.cost}</p>
                        <p style={{ color: "#ff6060", fontSize: "0.7rem" }}>wRuneX: {c.runex}</p>
                        <p style={{ color: "#6dde6d", fontSize: "0.7rem" }}>Item: {c.item}</p>
                      </div>
                    </div>
                    <p style={{ color: "#6b4f10", fontSize: "0.65rem", marginTop: 5 }}>{c.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p style={sectionTitle}>Character Minting</p>
              <div style={{ ...panel, fontSize: "0.72rem", color: "#a08040", lineHeight: 1.8 }}>
                <p>📦 <strong style={{ color: "#ffe8a0" }}>Mint Box</strong> — random character (archer/warrior/mage/miner), costs 50,000 real RuneX (on-chain)</p>
                <p>⚔ <strong style={{ color: "#ffe8a0" }}>HeroX Mint</strong> — 100,000 Gold → random hero class + rarity</p>
                <p>⛏ <strong style={{ color: "#60a5fa" }}>Free Starter Miner</strong> — claim once if you hold ≥1 RuneX in Phantom. 100 gp/day, no upgrades.</p>
                <p>Characters expire after their staking period — claim or unstake before then!</p>
              </div>
            </div>

            {/* Bank staking */}
            <div>
              <p style={sectionTitle}>🏦 Bank — Gold Staking</p>
              <p style={{ ...bodyText, marginBottom: 10 }}>
                Deposit Gold into the RuneX Bank to earn a permanent production boost on both mining and dungeon earnings. The more you deposit, the bigger the bonus — up to double output at 10M gp staked.
              </p>

              <div style={{ ...panel, padding: 0, overflow: "hidden", marginBottom: 10 }}>
                {[
                  { label: "1M gp",  boost: "+10%",  color: "#6dde6d"  },
                  { label: "3M gp",  boost: "+30%",  color: "#6dde6d"  },
                  { label: "5M gp",  boost: "+50%",  color: "#fbbf24"  },
                  { label: "7M gp",  boost: "+70%",  color: "#fbbf24"  },
                  { label: "10M gp", boost: "+100% 🏆", color: "#ffcc00" },
                ].map((r, i, arr) => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: i < arr.length-1 ? "1px solid rgba(107,79,16,0.25)" : "none" }}>
                    <span style={{ fontFamily: "'Cinzel',serif", color: "#ffe8a0", fontWeight: 700, fontSize: "0.72rem" }}>{r.label} staked</span>
                    <span style={{ color: r.color, fontWeight: 900, fontSize: "0.75rem" }}>{r.boost} to all GP</span>
                  </div>
                ))}
              </div>

              <div style={{ ...panel, fontSize: "0.7rem", color: "#a08040", lineHeight: 1.75 }}>
                <p>🔒 <strong style={{ color: "#ffe8a0" }}>Lock rule:</strong> Every deposit resets the lock to <strong>7 days from today</strong>. Your entire balance is locked — not just the new deposit.</p>
                <p>📈 <strong style={{ color: "#ffe8a0" }}>Boost applies to:</strong> Dungeon fighters (all classes) and Miners — Gold earned per day is multiplied.</p>
                <p>💰 <strong style={{ color: "#ffe8a0" }}>Withdraw:</strong> After the 7-day lock expires, you can reclaim all your gold — but the boost disappears immediately.</p>
                <p>♻ <strong style={{ color: "#ffe8a0" }}>Strategy tip:</strong> Build up to 10M gradually. Each top-up resets the lock, so plan large deposits for when you won't need the gold soon.</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
