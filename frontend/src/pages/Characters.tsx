import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "../store";
import { getPlayer, stakeChar, unstakeChar, claimTokens } from "../api";
import type { Character, CharacterItem } from "../api";

const RARITY_COLOR: Record<string, string> = {
  common: "#9ca3af", rare: "#60a5fa", epic: "#c084fc", legendary: "#fbbf24",
};
const RARITY_BG: Record<string, string> = {
  common: "rgba(156,163,175,0.08)", rare: "rgba(96,165,250,0.08)",
  epic: "rgba(192,132,252,0.08)", legendary: "rgba(251,191,36,0.08)",
};
const RARITY_BORDER: Record<string, string> = {
  common: "rgba(156,163,175,0.25)", rare: "rgba(96,165,250,0.25)",
  epic: "rgba(192,132,252,0.25)", legendary: "rgba(251,191,36,0.3)",
};

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function CharCard({ char, wallet, onRefresh }: { char: Character; wallet: string; onRefresh: () => void }) {
  const color  = RARITY_COLOR[char.rarity];
  const bg     = RARITY_BG[char.rarity];
  const border = RARITY_BORDER[char.rarity];

  const [busy,    setBusy]    = useState(false);
  const [dropped, setDropped] = useState<CharacterItem[]>([]);
  const [claimed, setClaimed] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);

  const { setPlayer } = useGameStore();

  async function handleStake() {
    setBusy(true);
    try {
      await stakeChar(wallet, char.id);
      const p = await getPlayer(wallet);
      setPlayer(p);
      onRefresh();
    } finally { setBusy(false); }
  }

  async function handleUnstake() {
    setBusy(true);
    try {
      const res = await unstakeChar(wallet, char.id);
      setClaimed(res.tokens_claimed);
      setDropped(res.items_dropped);
      const p = await getPlayer(wallet);
      setPlayer(p);
      onRefresh();
    } finally { setBusy(false); }
  }

  async function handleClaim() {
    setBusy(true);
    try {
      const res = await claimTokens(wallet, char.id);
      setClaimed(res.tokens_claimed);
      setDropped(res.items_dropped);
      if (res.expired) setExpired(true);
      const p = await getPlayer(wallet);
      setPlayer(p);
      onRefresh();
    } finally { setBusy(false); }
  }

  const isExpired = char.days_left <= 0 && char.hours_left <= 0;
  const urgency   = char.days_left <= 3;

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
         style={{ background: `linear-gradient(160deg,${bg.replace("0.08","0.12")} 0%,rgba(8,8,20,1) 100%)`, border: `1.5px solid ${border}` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: border }}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{char.emoji}</span>
          <div>
            <p className="font-black text-white capitalize">{char.class_type}</p>
            <p className="text-xs font-bold capitalize" style={{ color }}>{char.rarity_emoji} {char.rarity}</p>
          </div>
        </div>
        <div className="text-right">
          {isExpired ? (
            <span className="text-red-400 font-black text-xs">EXPIRED</span>
          ) : (
            <span className={`font-bold text-xs ${urgency ? "text-red-400" : "text-gray-400"}`}>
              {char.days_left}d {char.hours_left}h left
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Pending tokens */}
        {char.is_staked && (
          <div className="rounded-xl px-3 py-2 flex items-center justify-between"
               style={{ background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.15)" }}>
            <span className="text-gray-400 text-xs">Pending</span>
            <span className="text-yellow-400 font-black text-sm">+{fmtTokens(char.pending_tokens)} tokens</span>
          </div>
        )}

        {/* Equipped items */}
        {char.equipped_items.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {char.equipped_items.map(i => (
              <span key={i.id} className="text-xs rounded-full px-2 py-0.5 font-bold"
                    style={{ background: "rgba(255,255,255,0.07)", color: "#d1d5db" }}>
                {i.icon} {i.label}
              </span>
            ))}
          </div>
        )}

        {/* Claim toast */}
        {claimed !== null && (
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <p className="text-green-400 font-black">+{fmtTokens(claimed)} tokens claimed!</p>
            {dropped.length > 0 && (
              <div className="flex flex-wrap gap-1 justify-center mt-1">
                {dropped.map((d, i) => (
                  <span key={i} className="text-xs text-yellow-400">{d.icon} {d.label}</span>
                ))}
              </div>
            )}
            {expired && <p className="text-red-400 text-xs mt-1">Character has expired and was removed.</p>}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!char.is_staked && !isExpired && (
            <button onClick={handleStake} disabled={busy}
              className="flex-1 py-2 rounded-xl font-black text-sm transition-all"
              style={{ background: busy ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", cursor: busy ? "not-allowed" : "pointer" }}>
              {busy ? "…" : "▶ Stake"}
            </button>
          )}
          {char.is_staked && (
            <>
              <button onClick={handleClaim} disabled={busy}
                className="flex-1 py-2 rounded-xl font-black text-sm"
                style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.25)", color: "#fbbf24", cursor: busy ? "not-allowed" : "pointer" }}>
                {busy ? "…" : "💰 Claim"}
              </button>
              <button onClick={handleUnstake} disabled={busy}
                className="flex-1 py-2 rounded-xl font-black text-sm"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", cursor: busy ? "not-allowed" : "pointer" }}>
                {busy ? "…" : "⏹ Unstake"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Characters() {
  const { wallet, player, setPlayer } = useGameStore();
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      const p = await getPlayer(wallet);
      setPlayer(p);
    } finally { setLoading(false); }
  }, [wallet, setPlayer]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!wallet) return <p className="text-center text-gray-500 py-20">Connect wallet first.</p>;

  const chars = player?.characters ?? [];
  const active  = chars.filter(c => !c.is_staked && c.days_left > 0);
  const staked  = chars.filter(c => c.is_staked);
  const expired = chars.filter(c => c.days_left <= 0 && c.hours_left <= 0 && !c.is_staked);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">⚔️ Characters</h1>
        <button onClick={refresh} disabled={loading}
          className="text-xs text-gray-500 hover:text-white transition-colors">
          {loading ? "Loading…" : "↺ Refresh"}
        </button>
      </div>

      {chars.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">📦</p>
          <p>No characters yet. Go mint a box!</p>
        </div>
      )}

      {staked.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold text-green-400 uppercase tracking-widest">Staked ({staked.length})</p>
          {staked.map(c => <CharCard key={c.id} char={c} wallet={wallet} onRefresh={refresh} />)}
        </section>
      )}

      {active.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ready to stake ({active.length})</p>
          {active.map(c => <CharCard key={c.id} char={c} wallet={wallet} onRefresh={refresh} />)}
        </section>
      )}

      {expired.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Expired ({expired.length})</p>
          {expired.map(c => <CharCard key={c.id} char={c} wallet={wallet} onRefresh={refresh} />)}
        </section>
      )}
    </div>
  );
}
