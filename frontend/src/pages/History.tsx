import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "../store";
import { getTransactions } from "../api";
import type { Transaction } from "../api";

const TX_ICONS: Record<string, string> = {
  char_mint:        "📦",
  hero_mint:        "✨",
  item_drop:        "🎁",
  miner_upgrade:    "🪨",
  battle_royale:    "⚔️",
  battle_royale_win:"🏆",
  chest:            "🎁",
};

const TX_LABELS: Record<string, string> = {
  char_mint:        "Character Minted",
  hero_mint:        "HeroX Minted",
  item_drop:        "Item Dropped",
  miner_upgrade:    "Miner Upgraded",
  battle_royale:    "Battle Royale",
  battle_royale_win:"Battle Royale Win",
  chest:            "Chest Opened",
};

const TX_COLOR: Record<string, string> = {
  char_mint:        "#60a5fa",
  hero_mint:        "#c084fc",
  item_drop:        "#6dde6d",
  miner_upgrade:    "#fbbf24",
  battle_royale:    "#ef4444",
  battle_royale_win:"#ffcc00",
  chest:            "#6dde6d",
};

type FilterType = "all" | "char_mint" | "hero_mint" | "item_drop" | "miner_upgrade" | "battle_royale";

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "all",          label: "All" },
  { id: "item_drop",    label: "Items" },
  { id: "char_mint",    label: "Chars" },
  { id: "hero_mint",    label: "Heroes" },
  { id: "miner_upgrade",label: "Upgrades" },
  { id: "battle_royale",label: "Battle Royale" },
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function History() {
  const { wallet } = useGameStore();
  const [txs,     setTxs]     = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState<FilterType>("all");

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try { setTxs(await getTransactions(wallet)); }
    finally { setLoading(false); }
  }, [wallet]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!wallet) return <p className="text-center text-gray-500 py-20">Connect wallet first.</p>;

  const filtered = txs.filter(tx => {
    if (filter === "all") return true;
    if (filter === "battle_royale") return tx.tx_type.startsWith("battle_royale");
    return tx.tx_type === filter;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "1.5rem", fontWeight: 900 }}>📜 History</h1>
          <p className="text-xs" style={{ color: "#a08040" }}>Last {txs.length} transactions</p>
        </div>
        <button onClick={refresh} disabled={loading} style={{ color: "#a08040", fontSize: "0.75rem" }}>
          {loading ? "…" : "↺ Refresh"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: "0.68rem",
              fontWeight: 700,
              fontFamily: "'Cinzel',serif",
              whiteSpace: "nowrap",
              border: filter === f.id ? "1px solid #ffcc00" : "1px solid #3d2a00",
              background: filter === f.id ? "rgba(255,204,0,0.12)" : "rgba(0,0,0,0.3)",
              color: filter === f.id ? "#ffcc00" : "#a08040",
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      {loading && txs.length === 0 ? (
        <p className="text-center text-gray-500 py-10 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl py-12 text-center" style={{ border: "2px dashed #3d2a00" }}>
          <p style={{ color: "#6b4f10", fontFamily: "'Cinzel',serif" }}>No transactions yet</p>
          <p className="text-xs mt-1" style={{ color: "#3d2a00" }}>Mint characters and heroes to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(tx => {
            const icon  = TX_ICONS[tx.tx_type]  ?? "📋";
            const label = TX_LABELS[tx.tx_type] ?? tx.tx_type;
            const color = TX_COLOR[tx.tx_type]  ?? "#a08040";
            const isGain = tx.value > 0;
            const isLoss = tx.value < 0;

            return (
              <div key={tx.id}
                   className="rounded-xl px-3 py-2.5 flex items-center gap-3"
                   style={{ background: "rgba(0,0,0,0.25)", border: "1px solid #2a1a00" }}>
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color }}>
                    {label}
                  </p>
                  <p className="text-xs truncate" style={{ color: "#a08040" }}>{tx.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {isGain && (
                    <p className="text-xs font-bold" style={{ color: "#6dde6d" }}>
                      +{tx.value.toLocaleString()}
                    </p>
                  )}
                  {isLoss && (
                    <p className="text-xs font-bold" style={{ color: "#ef4444" }}>
                      {tx.value.toLocaleString()}
                    </p>
                  )}
                  <p style={{ fontSize: "0.6rem", color: "#6b4f10" }}>
                    {tx.created_at ? fmtDate(tx.created_at) : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
