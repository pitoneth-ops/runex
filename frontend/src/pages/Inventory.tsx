import { useState, useEffect } from "react";
import { useGameStore } from "../store";
import { getPlayer, equipItem, unequipItem } from "../api";
import type { CharacterItem, Character } from "../api";
import { OsrsSprite, OsrsIcon } from "../components/OsrsSprite";
import { CHAR_SPRITES, ARMOR_ICONS, ITEM_SPRITES } from "../sprites";

const ITEM_COLOR: Record<string, string> = {
  vitality: "#6dde6d", token_boost: "#ffcc00", drop_boost: "#a78bfa",
};

const TOTAL_SLOTS = 28;

export default function Inventory() {
  const { wallet, player, setPlayer } = useGameStore();
  const [selected, setSelected] = useState<CharacterItem | null>(null);
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState("");

  useEffect(() => {
    if (wallet) getPlayer(wallet).then(setPlayer).catch(() => {});
  }, [wallet]);

  const freeItems     = player?.inventory ?? [];
  const equippedItems = (player?.characters ?? []).flatMap(c => c.equipped_items);
  const allItems      = [...freeItems, ...equippedItems];

  const chars = (player?.characters ?? []).filter(c => c.class_type !== "miner" && c.days_left > 0);

  const slots: (CharacterItem | null)[] = [
    ...allItems,
    ...Array(Math.max(0, TOTAL_SLOTS - allItems.length)).fill(null),
  ].slice(0, TOTAL_SLOTS);

  const isEquipped = (item: CharacterItem) => equippedItems.some(e => e.id === item.id);

  async function handleEquip(char: Character) {
    if (!wallet || !selected) return;
    setBusy(true); setMsg("");
    try {
      await equipItem(wallet, char.id, selected.id);
      const p = await getPlayer(wallet); setPlayer(p);
      setSelected(null); setMsg("Equipped!");
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMsg(detail ?? "Failed to equip");
    } finally { setBusy(false); }
  }

  async function handleUnequip(item: CharacterItem) {
    if (!wallet || !item.equipped_on) return;
    setBusy(true); setMsg("");
    try {
      await unequipItem(wallet, item.equipped_on, item.id);
      const p = await getPlayer(wallet); setPlayer(p);
      setMsg("Unequipped!");
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMsg(detail ?? "Failed");
    } finally { setBusy(false); }
  }

  function handleSlotClick(item: CharacterItem | null) {
    if (!item) { setSelected(null); return; }
    setSelected(selected?.id === item.id ? null : item);
  }

  if (!wallet) return (
    <div className="text-center py-20" style={{ color: "#a08040" }}>Connect wallet first.</div>
  );

  return (
    <div className="animate-fade-in" style={{ padding: "0 8px" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h1 className="text-2xl font-black" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00" }}>🎒 Inventory</h1>
        <span className="text-xs" style={{ fontFamily: "'Cinzel',serif", color: "#a08040" }}>
          {allItems.length}/{TOTAL_SLOTS}
        </span>
      </div>

      {/* Toast */}
      {msg && (
        <div className="rounded-xl p-2 text-center text-sm font-bold mb-3"
             style={{ background: msg.includes("!") ? "rgba(109,222,109,0.1)" : "rgba(239,68,68,0.1)",
                      border: `1px solid ${msg.includes("!") ? "rgba(109,222,109,0.3)" : "rgba(239,68,68,0.3)"}`,
                      color: msg.includes("!") ? "#6dde6d" : "#f87171" }}>
          {msg}
        </div>
      )}

      {/* OSRS-style inventory grid — full width */}
      <div style={{
        background: "#3a3625",
        border: "4px solid",
        borderColor: "#857348 #3d2e0f #3d2e0f #857348",
        boxShadow: "inset 3px 3px 0 #1a1000, inset -3px -3px 0 #6b5a30",
        padding: 4,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 3,
        width: "100%",
      }}>
        {slots.map((item, i) => {
          const isSel    = item && selected?.id === item.id;
          const equipped = item && isEquipped(item);
          return (
            <div
              key={i}
              onClick={() => handleSlotClick(item)}
              title={item ? `${item.label}${equipped ? " (equipped)" : ""}` : ""}
              style={{
                aspectRatio: "1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                cursor: item ? "pointer" : "default",
                background: isSel
                  ? "rgba(255,204,0,0.22)"
                  : item ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.18)",
                outline: isSel ? "2px solid #ffcc00" : "none",
                outlineOffset: -2,
              }}
            >
              {item && (
                <>
                  <OsrsIcon
                    src={ITEM_SPRITES[item.item_type] ?? ""}
                    fallback={item.icon}
                    size={44}
                  />
                  {equipped && (
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "rgba(96,165,250,0.2)",
                      border: "2px solid rgba(96,165,250,0.45)",
                      pointerEvents: "none",
                    }} />
                  )}
                  <span style={{
                    position: "absolute", bottom: 2, right: 3,
                    fontSize: "0.6rem", fontWeight: 900, color: "#ffcc00",
                    textShadow: "1px 1px 0 #000", lineHeight: 1,
                  }}>1</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {allItems.length === 0 && (
        <p className="text-sm text-center mt-4" style={{ color: "#6b5a30" }}>
          No items yet. Stake fighters — they drop item chests over time.
        </p>
      )}

      {/* Selected item panel */}
      {selected && (
        <div className="rounded-2xl p-4 mt-4 space-y-3"
             style={{ background: "rgba(255,204,0,0.05)", border: "1px solid rgba(255,204,0,0.2)" }}>
          <div className="flex items-center gap-3">
            <OsrsIcon src={ITEM_SPRITES[selected.item_type] ?? ""} fallback={selected.icon} size={44} />
            <div>
              <p className="font-black" style={{ fontFamily: "'Cinzel',serif", color: "#ffe8a0", fontSize: "1rem" }}>{selected.label}</p>
              <p className="text-xs capitalize" style={{ color: ITEM_COLOR[selected.item_type] }}>
                {selected.item_type.replace("_", " ")}
              </p>
            </div>
          </div>

          {isEquipped(selected) ? (
            <button onClick={() => handleUnequip(selected)} disabled={busy}
              className="osrs-btn-red w-full text-sm">
              {busy ? "…" : "Remove from character"}
            </button>
          ) : (
            <>
              <p className="text-xs" style={{ color: "#a08040" }}>Equip on:</p>
              {chars.length === 0
                ? <p className="text-xs" style={{ color: "#6b5a30" }}>No fighters available (unstaked).</p>
                : <div className="grid grid-cols-2 gap-2">
                    {chars.map(c => (
                      <button key={c.id} onClick={() => handleEquip(c)} disabled={busy || c.is_staked}
                        className="flex items-center gap-2 rounded-xl px-3 py-2"
                        style={{
                          background: "rgba(0,0,0,0.25)", border: "1px solid #3d2a00",
                          opacity: c.is_staked ? 0.4 : 1, cursor: c.is_staked ? "not-allowed" : "pointer",
                        }}>
                        <OsrsSprite srcs={CHAR_SPRITES[c.class_type]?.[c.rarity] ?? []} fallback={c.emoji ?? "?"} size={28} />
                        <OsrsIcon src={ARMOR_ICONS[c.class_type]?.[c.rarity] ?? ""} fallback="" size={16} />
                        <div className="text-left">
                          <p className="text-xs font-black capitalize" style={{ color: "#ffe8a0" }}>{c.class_type}</p>
                          <p className="text-xs" style={{ color: "#6b5a30" }}>{c.is_staked ? "staked" : `${c.days_left}d`}</p>
                        </div>
                      </button>
                    ))}
                  </div>
              }
            </>
          )}
        </div>
      )}
    </div>
  );
}
