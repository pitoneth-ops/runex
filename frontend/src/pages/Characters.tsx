import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "../store";
import { getPlayer, equipHeroItem, unequipHeroItem } from "../api";
import type { CharacterItem, HeroX, EquipSlot } from "../api";
import { OsrsSprite } from "../components/OsrsSprite";
import { HERO_SPRITES, RUNEX_ICON, getEquipSprite } from "../sprites";

// ── Constants ─────────────────────────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  common: "#9ca3af", rare: "#60a5fa", epic: "#c084fc", legendary: "#fbbf24",
};
const RARITY_BORDER: Record<string, string> = {
  common: "rgba(156,163,175,0.25)", rare: "rgba(96,165,250,0.3)",
  epic: "rgba(192,132,252,0.3)", legendary: "rgba(251,191,36,0.35)",
};
const CLASS_ICON: Record<string, string> = {
  berserker: "⚔️", ranger: "🏹", sorcerer: "🔮", paladin: "🛡️",
};
const CLASS_LABEL: Record<string, string> = {
  berserker: "Berserker", ranger: "Ranger", sorcerer: "Sorcerer", paladin: "Paladin",
};

// OSRS equipment slot layout: 3 columns × 6 rows (null = empty cell)
const SLOT_GRID: (EquipSlot | null)[][] = [
  [null,    "head",   null  ],
  ["cape",  "neck",   null  ],
  ["weapon","body",   "shield"],
  [null,    "legs",   null  ],
  ["hands", null,     "feet"],
  ["ring",  null,     null  ],
];

const SLOT_EMOJI: Record<EquipSlot, string> = {
  head:   "⛑",  neck:   "📿", cape:   "🧣",
  weapon: "⚔",  body:   "🪬", shield: "🛡",
  legs:   "👖", hands:  "🧤", feet:   "👢",
  ring:   "💍",
};
const SLOT_LABEL: Record<EquipSlot, string> = {
  head: "Head", neck: "Neck", cape: "Cape", weapon: "Weapon",
  body: "Body", shield: "Shield", legs: "Legs", hands: "Hands",
  feet: "Feet", ring: "Ring",
};

const STAT_COLOR: Record<string, string> = {
  vitalidade: "#4ade80", atk: "#ef4444", destreza: "#fbbf24", magia: "#c084fc",
};
const STAT_LABEL: Record<string, string> = {
  vitalidade: "Vita", atk: "Atk", destreza: "Des", magia: "Mag",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPrimaryStatLabel(item: CharacterItem): { stat: string; val: number } {
  if (item.stat_atk)        return { stat: "atk",        val: item.stat_atk };
  if (item.stat_destreza)   return { stat: "destreza",   val: item.stat_destreza };
  if (item.stat_magia)      return { stat: "magia",       val: item.stat_magia };
  if (item.stat_vitalidade) return { stat: "vitalidade", val: item.stat_vitalidade };
  return { stat: "vitalidade", val: 0 };
}

function fmtRunex(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

// ── Equipment slot cell ────────────────────────────────────────────────────────

function SlotCell({ slot, equippedItem, onClick, selected }: {
  slot: EquipSlot;
  equippedItem: CharacterItem | null;
  onClick: () => void;
  selected: boolean;
}) {
  const spriteSrcs = equippedItem ? getEquipSprite(equippedItem) : [];
  const rarity     = equippedItem?.item_rarity ?? null;
  const { stat, val } = equippedItem ? getPrimaryStatLabel(equippedItem) : { stat: "", val: 0 };

  const borderColor = selected
    ? "#ffcc00"
    : equippedItem
    ? RARITY_COLOR[rarity ?? "common"]
    : "rgba(100,75,20,0.5)";

  return (
    <button
      onClick={onClick}
      title={equippedItem ? equippedItem.item_name ?? slot : SLOT_LABEL[slot]}
      style={{
        width: 52, height: 52, borderRadius: 6, cursor: "pointer",
        background: equippedItem ? "rgba(30,20,0,0.9)" : "rgba(10,8,2,0.8)",
        border: `2px solid ${borderColor}`,
        boxShadow: selected ? `0 0 8px ${borderColor}` : undefined,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 1, position: "relative", transition: "all 0.15s",
      }}>
      {equippedItem ? (
        <>
          <OsrsSprite srcs={spriteSrcs} fallback={SLOT_EMOJI[slot]} size={34} pixelated={false} />
          {val > 0 && (
            <span style={{ fontSize: "0.5rem", fontWeight: 700, color: STAT_COLOR[stat], lineHeight: 1 }}>
              +{val}
            </span>
          )}
        </>
      ) : (
        <span style={{ fontSize: "1.2rem", opacity: 0.35 }}>{SLOT_EMOJI[slot]}</span>
      )}
    </button>
  );
}

// ── Equipment panel ────────────────────────────────────────────────────────────

function EquipmentPanel({ hero, inventory, wallet, onRefresh }: {
  hero: HeroX; inventory: CharacterItem[]; wallet: string; onRefresh: () => void;
}) {
  const [selectedSlot, setSelectedSlot] = useState<EquipSlot | null>(null);
  const [busy, setBusy]                 = useState(false);
  const [msg,  setMsg]                  = useState("");
  const { setPlayer } = useGameStore();

  const border     = RARITY_BORDER[hero.rarity];
  const spriteSrcs = HERO_SPRITES[hero.hero_class]?.[hero.rarity] ?? [];

  // Map slot → equipped item for this hero
  const equipped: Partial<Record<EquipSlot, CharacterItem>> = {};
  for (const item of hero.equipped_items ?? []) {
    if (item.item_slot) equipped[item.item_slot as EquipSlot] = item;
  }

  // Inventory items for the selected slot
  const slotItems = selectedSlot
    ? inventory.filter(i => i.item_type === "equipment" && i.item_slot === selectedSlot && !i.is_equipped)
    : [];

  function handleSlotClick(slot: EquipSlot) {
    setSelectedSlot(prev => prev === slot ? null : slot);
    setMsg("");
  }

  async function handleEquip(item: CharacterItem) {
    setBusy(true); setMsg("");
    try {
      await equipHeroItem(wallet, hero.id, item.id);
      const p = await getPlayer(wallet); setPlayer(p); onRefresh();
      setMsg(`Equipado: ${item.item_name}`);
      setSelectedSlot(null);
    } catch (e: unknown) {
      const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMsg(d ?? "Erro ao equipar");
    } finally { setBusy(false); }
  }

  async function handleUnequip(item: CharacterItem) {
    setBusy(true); setMsg("");
    try {
      await unequipHeroItem(wallet, hero.id, item.id);
      const p = await getPlayer(wallet); setPlayer(p); onRefresh();
      setMsg("Item removido.");
      setSelectedSlot(null);
    } catch (e: unknown) {
      const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMsg(d ?? "Erro");
    } finally { setBusy(false); }
  }

  // Total stat bonuses from equipped items
  const bonus = { vitalidade: 0, atk: 0, destreza: 0, magia: 0 };
  for (const item of hero.equipped_items ?? []) {
    bonus.vitalidade += item.stat_vitalidade ?? 0;
    bonus.atk        += item.stat_atk        ?? 0;
    bonus.destreza   += item.stat_destreza   ?? 0;
    bonus.magia      += item.stat_magia       ?? 0;
  }

  const selectedEquipped = selectedSlot ? equipped[selectedSlot] ?? null : null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${border}`, background: "rgba(8,6,0,0.97)" }}>
      {/* Hero header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
        <OsrsSprite srcs={spriteSrcs} fallback={CLASS_ICON[hero.hero_class]} size={52} pixelated={false} />
        <div className="flex-1">
          <p className="font-black" style={{ fontFamily: "'Cinzel',serif", color: "#fff", fontSize: "0.9rem" }}>
            {CLASS_ICON[hero.hero_class]} {CLASS_LABEL[hero.hero_class]}
          </p>
          <p className={`text-xs font-bold osrs-label-${hero.rarity}`}>{hero.rarity_emoji} {hero.rarity}</p>
        </div>
        <div className="text-right text-xs" style={{ color: "#a08040" }}>
          <p>Best: Phase {hero.best_phase}</p>
          <div className="flex items-center gap-1 justify-end mt-0.5">
            <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={12} />
            <span>{fmtRunex(hero.total_runex_earned)}</span>
          </div>
        </div>
      </div>

      {/* Equipment grid + stat bonuses */}
      <div className="flex gap-4 px-4 py-4">
        {/* OSRS-style slot grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 52px)", gap: 5 }}>
          {SLOT_GRID.flat().map((slot, i) =>
            slot ? (
              <SlotCell
                key={slot}
                slot={slot}
                equippedItem={equipped[slot] ?? null}
                onClick={() => handleSlotClick(slot)}
                selected={selectedSlot === slot}
              />
            ) : (
              <div key={`empty-${i}`} style={{ width: 52, height: 52 }} />
            )
          )}
        </div>

        {/* Stat bonuses */}
        <div className="flex-1 flex flex-col gap-2 justify-center">
          <p className="text-xs font-bold" style={{ fontFamily: "'Cinzel',serif", color: "#a08040" }}>
            Item Bonuses
          </p>
          {(["vitalidade", "atk", "destreza", "magia"] as const).map(stat => (
            <div key={stat} className="flex items-center justify-between">
              <span style={{ fontSize: "0.7rem", color: "#6b4f10", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {STAT_LABEL[stat]}
              </span>
              <span style={{
                fontSize: "0.75rem", fontWeight: 700,
                color: bonus[stat] > 0 ? STAT_COLOR[stat] : "rgba(107,79,16,0.5)",
              }}>
                {bonus[stat] > 0 ? `+${bonus[stat]}` : "—"}
              </span>
            </div>
          ))}
          <p className="text-xs mt-2" style={{ color: "#6b4f10" }}>
            {Object.values(equipped).filter(Boolean).length}/10 slots
          </p>
        </div>
      </div>

      {/* Selected slot panel */}
      {selectedSlot && (
        <div style={{ borderTop: `1px solid ${border}`, padding: "12px 16px" }}>
          <p className="text-xs font-bold mb-2" style={{ color: "#ffcc00", fontFamily: "'Cinzel',serif" }}>
            {SLOT_EMOJI[selectedSlot]} {SLOT_LABEL[selectedSlot]}
          </p>

          {/* Currently equipped in this slot */}
          {selectedEquipped && (
            <div className="flex items-center justify-between rounded-xl px-3 py-2 mb-2"
                 style={{ background: "rgba(251,191,36,0.07)", border: `1px solid ${RARITY_COLOR[selectedEquipped.item_rarity ?? "common"]}55` }}>
              <div className="flex items-center gap-2">
                <OsrsSprite srcs={getEquipSprite(selectedEquipped)} fallback={SLOT_EMOJI[selectedSlot]} size={28} pixelated={false} />
                <div>
                  <p className="text-sm font-bold" style={{ color: RARITY_COLOR[selectedEquipped.item_rarity ?? "common"] }}>
                    {selectedEquipped.item_name}
                  </p>
                  {(() => { const { stat, val } = getPrimaryStatLabel(selectedEquipped); return (
                    <p className="text-xs" style={{ color: STAT_COLOR[stat] }}>+{val} {stat}</p>
                  ); })()}
                </div>
              </div>
              <button
                onClick={() => handleUnequip(selectedEquipped)}
                disabled={busy}
                style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)", color: "#ef4444", cursor: "pointer" }}>
                Remover
              </button>
            </div>
          )}

          {/* Available items from inventory for this slot */}
          {slotItems.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs" style={{ color: "#6b4f10" }}>Inventário — clique para equipar:</p>
              {slotItems.map(item => {
                const { stat, val } = getPrimaryStatLabel(item);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleEquip(item)}
                    disabled={busy}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-all hover:brightness-125"
                    style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${RARITY_COLOR[item.item_rarity ?? "common"]}44` }}>
                    <OsrsSprite srcs={getEquipSprite(item)} fallback={SLOT_EMOJI[selectedSlot]} size={28} pixelated={false} />
                    <div className="flex-1">
                      <p className="font-bold text-sm" style={{ color: RARITY_COLOR[item.item_rarity ?? "common"] }}>
                        {item.item_name}
                      </p>
                      <p className="text-xs" style={{ color: STAT_COLOR[stat] }}>+{val} {stat}</p>
                    </div>
                    <span className="text-xs capitalize" style={{ color: "#a08040" }}>{item.item_rarity}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            !selectedEquipped && (
              <p className="text-xs" style={{ color: "#6b4f10" }}>
                Sem itens de {SLOT_LABEL[selectedSlot].toLowerCase()} no inventário.<br />
                Complete batalhas HeroX ou missões no dungeon para obter equipamentos.
              </p>
            )
          )}
        </div>
      )}

      {msg && (
        <p className="text-xs text-center font-bold px-4 pb-3" style={{ color: msg.includes("rro") ? "#f87171" : "#4ade80" }}>
          {msg}
        </p>
      )}
    </div>
  );
}

// ── Inventory item card (non-equipment or unequipped) ─────────────────────────

function InventoryGrid({ items }: { items: CharacterItem[] }) {
  if (items.length === 0) return null;

  const equipItems = items.filter(i => i.item_type === "equipment");
  const oldItems   = items.filter(i => i.item_type !== "equipment");

  return (
    <div className="space-y-3">
      {equipItems.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#a08040" }}>
            Equipamentos no Inventário ({equipItems.length})
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px,1fr))", gap: 8 }}>
            {equipItems.map(item => {
              const { stat, val } = getPrimaryStatLabel(item);
              const col = RARITY_COLOR[item.item_rarity ?? "common"];
              return (
                <div key={item.id} className="rounded-xl p-2 text-center"
                     style={{ background: "rgba(20,14,0,0.9)", border: `1px solid ${col}44` }}>
                  <OsrsSprite srcs={getEquipSprite(item)} fallback={SLOT_EMOJI[item.item_slot as EquipSlot] ?? "📦"} size={32} pixelated={false} />
                  <p className="text-xs font-bold mt-1 truncate" style={{ color: col }}>{item.item_name}</p>
                  <p style={{ fontSize: "0.6rem", color: STAT_COLOR[stat] }}>+{val} {stat}</p>
                  <p style={{ fontSize: "0.55rem", color: "#6b4f10" }}>{SLOT_LABEL[item.item_slot as EquipSlot] ?? item.item_slot}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {oldItems.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#a08040" }}>
            Itens de Fighter ({oldItems.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {oldItems.map(item => (
              <div key={item.id} className="rounded-lg px-2 py-1 flex items-center gap-1"
                   style={{ background: "rgba(20,14,0,0.9)", border: "1px solid rgba(107,79,16,0.3)" }}>
                <span>{item.icon}</span>
                <span className="text-xs" style={{ color: "#ffe8a0" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Characters() {
  const { wallet, player, setPlayer } = useGameStore();
  const [loading,      setLoading]    = useState(false);
  const [selectedHero, setSelectedHero] = useState(0);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try { const p = await getPlayer(wallet); setPlayer(p); }
    finally { setLoading(false); }
  }, [wallet, setPlayer]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!wallet) return <p className="text-center text-gray-500 py-20">Conecte a carteira primeiro.</p>;

  const heroes    = player?.heroes ?? [];
  const inventory = player?.inventory ?? [];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00" }}>
          ✗ HeroX Equip
        </h1>
        <button onClick={refresh} disabled={loading} className="text-xs transition-colors" style={{ color: "#a08040" }}>
          {loading ? "…" : "↺"}
        </button>
      </div>

      {heroes.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">✗</p>
          <p>Nenhum HeroX. Vá em Heroes e mine um!</p>
        </div>
      ) : (
        <>
          {/* Hero selector tabs */}
          {heroes.length > 1 && (
            <div className="flex gap-2">
              {heroes.map((h, i) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedHero(i)}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
                  style={{
                    background: selectedHero === i ? "rgba(255,204,0,0.12)" : "rgba(0,0,0,0.3)",
                    border: `1px solid ${selectedHero === i ? "#ffcc00" : RARITY_BORDER[h.rarity]}`,
                    color: selectedHero === i ? "#ffcc00" : "#a08040",
                  }}>
                  {CLASS_ICON[h.hero_class]} {CLASS_LABEL[h.hero_class]}
                  <span className={`osrs-label-${h.rarity}`}>{h.rarity_emoji}</span>
                </button>
              ))}
            </div>
          )}

          {/* Equipment panel for selected hero */}
          {heroes[selectedHero] && (
            <EquipmentPanel
              hero={heroes[selectedHero]}
              inventory={inventory}
              wallet={wallet}
              onRefresh={refresh}
            />
          )}

          {/* Full inventory */}
          {inventory.length > 0 ? (
            <InventoryGrid items={inventory} />
          ) : (
            <div className="rounded-xl px-4 py-3 text-sm"
                 style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", color: "#6b7280" }}>
              Inventário vazio. Complete batalhas HeroX ou fases do dungeon para obter equipamentos!
            </div>
          )}
        </>
      )}
    </div>
  );
}
