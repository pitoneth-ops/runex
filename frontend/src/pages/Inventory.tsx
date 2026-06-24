import { useState, useEffect } from "react";
import { useGameStore } from "../store";
import { getPlayer, equipItem, unequipItem } from "../api";
import type { CharacterItem, Character } from "../api";

const ITEM_COLOR: Record<string, string> = {
  vitality: "#4ade80", token_boost: "#fbbf24", drop_boost: "#a78bfa",
};

export default function Inventory() {
  const { wallet, player, setPlayer } = useGameStore();
  const [selected, setSelected] = useState<CharacterItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState("");

  useEffect(() => {
    if (wallet) getPlayer(wallet).then(setPlayer).catch(() => {});
  }, [wallet]);

  const inventory = player?.inventory ?? [];
  const chars     = (player?.characters ?? []).filter(c => c.class_type !== "miner" && c.days_left > 0);

  async function handleEquip(char: Character) {
    if (!wallet || !selected) return;
    setBusy(true);
    setMsg("");
    try {
      await equipItem(wallet, char.id, selected.id);
      const p = await getPlayer(wallet);
      setPlayer(p);
      setSelected(null);
      setMsg("Item equipped!");
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMsg(detail ?? "Failed to equip");
    } finally { setBusy(false); }
  }

  async function handleUnequip(item: CharacterItem) {
    if (!wallet || !item.equipped_on) return;
    setBusy(true);
    setMsg("");
    try {
      await unequipItem(wallet, item.equipped_on, item.id);
      const p = await getPlayer(wallet);
      setPlayer(p);
      setMsg("Item unequipped!");
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMsg(detail ?? "Failed to unequip");
    } finally { setBusy(false); }
  }

  if (!wallet) return <p className="text-center text-gray-500 py-20">Connect wallet first.</p>;

  const allItems = [
    ...(player?.inventory ?? []),
    ...(player?.characters ?? []).flatMap(c => c.equipped_items),
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-2xl font-black text-white">🎒 Inventory</h1>

      {allItems.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">📭</p>
          <p>No items yet. Stake fighters to earn chest drops!</p>
        </div>
      )}

      {msg && (
        <div className="rounded-xl p-3 text-center text-sm font-bold"
             style={{ background: msg.includes("!") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      color: msg.includes("!") ? "#4ade80" : "#f87171" }}>
          {msg}
        </div>
      )}

      {/* Unequipped items */}
      {inventory.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Items ({inventory.length})</p>
          <div className="grid grid-cols-2 gap-3">
            {inventory.map(item => (
              <button key={item.id}
                onClick={() => setSelected(selected?.id === item.id ? null : item)}
                className="rounded-xl p-3 text-left transition-all"
                style={{
                  background: selected?.id === item.id ? "rgba(250,204,21,0.1)" : "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${selected?.id === item.id ? "rgba(250,204,21,0.4)" : "rgba(255,255,255,0.08)"}`,
                }}>
                <p className="text-2xl mb-1">{item.icon}</p>
                <p className="font-black text-white text-sm capitalize">{item.item_type.replace("_", " ")}</p>
                <p className="text-xs font-bold" style={{ color: ITEM_COLOR[item.item_type] }}>{item.label}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Equip picker */}
      {selected && (
        <section className="space-y-3">
          <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest">
            Equip "{selected.icon} {selected.label}" on:
          </p>
          {chars.length === 0 && (
            <p className="text-gray-500 text-sm">No eligible characters (unstaked Archer/Warrior/Mage needed).</p>
          )}
          {chars.map(c => (
            <button key={c.id} onClick={() => handleEquip(c)} disabled={busy || c.is_staked}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
              style={{
                background: c.is_staked ? "rgba(255,255,255,0.02)" : "rgba(34,197,94,0.06)",
                border: `1px solid ${c.is_staked ? "rgba(255,255,255,0.06)" : "rgba(34,197,94,0.2)"}`,
                opacity: c.is_staked ? 0.4 : 1,
                cursor: c.is_staked ? "not-allowed" : "pointer",
              }}>
              <span className="text-2xl">{c.emoji}</span>
              <div>
                <p className="font-black text-white text-sm capitalize">{c.class_type} · {c.rarity}</p>
                <p className="text-gray-500 text-xs">{c.days_left}d left {c.is_staked ? "· Unstake to equip" : ""}</p>
              </div>
            </button>
          ))}
        </section>
      )}

      {/* Equipped items per character */}
      {(player?.characters ?? []).filter(c => c.equipped_items.length > 0).map(c => (
        <section key={c.id} className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {c.emoji} {c.class_type} equipped
          </p>
          {c.equipped_items.map(item => (
            <div key={item.id} className="flex items-center justify-between rounded-xl px-4 py-3"
                 style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="font-bold text-white text-sm">{item.label}</p>
                  <p className="text-xs text-gray-500 capitalize">{item.item_type.replace("_", " ")}</p>
                </div>
              </div>
              <button onClick={() => handleUnequip(item)} disabled={busy || c.is_staked}
                className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors disabled:opacity-30">
                {c.is_staked ? "Unstake first" : "Remove"}
              </button>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
