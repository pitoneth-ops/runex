import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "../store";
import { getPlayer, stakeChar, unstakeChar, claimTokens, claimAll, stakeAll } from "../api";
import type { Character, CharacterItem } from "../api";
import { OsrsSprite, OsrsIcon } from "../components/OsrsSprite";
import { CHAR_SPRITES, ARMOR_ICONS, GAME_ICONS, CHEST_SPRITES, ITEM_SPRITES } from "../sprites";

const RARITY_COLOR: Record<string, string> = {
  common: "#9ca3af", rare: "#60a5fa", epic: "#c084fc", legendary: "#fbbf24",
};
const RARITY_BORDER: Record<string, string> = {
  common: "rgba(156,163,175,0.2)", rare: "rgba(96,165,250,0.25)",
  epic: "rgba(192,132,252,0.25)", legendary: "rgba(251,191,36,0.3)",
};
const RARITY_BG: Record<string, string> = {
  common: "rgba(156,163,175,0.06)", rare: "rgba(96,165,250,0.06)",
  epic: "rgba(192,132,252,0.06)", legendary: "rgba(251,191,36,0.06)",
};
const TOKENS_DAY: Record<string, number> = {
  common: 10000, rare: 12500, epic: 15000, legendary: 20000,
};

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function FighterCard({ char, wallet, onRefresh, onChestDrop }: {
  char: Character; wallet: string; onRefresh: () => void;
  onChestDrop: (items: CharacterItem[]) => void;
}) {
  const [busy, setBusy]       = useState(false);
  const [toast, setToast]     = useState<{ tokens: number; items: CharacterItem[] } | null>(null);
  const [expired, setExpired] = useState(false);
  const { setPlayer }         = useGameStore();

  const border = RARITY_BORDER[char.rarity];
  const bg     = RARITY_BG[char.rarity];
  const isExpired = char.days_left <= 0 && char.hours_left <= 0;
  const urgency   = char.days_left <= 3 && !isExpired;
  const spriteSrcs = CHAR_SPRITES[char.class_type]?.[char.rarity] ?? [];
  const armorSrc   = ARMOR_ICONS[char.class_type]?.[char.rarity] ?? "";

  async function handleStake() {
    setBusy(true);
    try {
      await stakeChar(wallet, char.id);
      const p = await getPlayer(wallet); setPlayer(p); onRefresh();
    } finally { setBusy(false); }
  }

  async function handleUnstake() {
    setBusy(true);
    try {
      const res = await unstakeChar(wallet, char.id);
      setToast({ tokens: res.tokens_claimed, items: res.items_dropped });
      if (res.items_dropped.length > 0) onChestDrop(res.items_dropped);
      const p = await getPlayer(wallet); setPlayer(p); onRefresh();
    } finally { setBusy(false); }
  }

  async function handleClaim() {
    setBusy(true);
    try {
      const res = await claimTokens(wallet, char.id);
      setToast({ tokens: res.tokens_claimed, items: res.items_dropped });
      if (res.items_dropped.length > 0) onChestDrop(res.items_dropped);
      if (res.expired) setExpired(true);
      const p = await getPlayer(wallet); setPlayer(p); onRefresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
         style={{ background: `linear-gradient(160deg,${bg.replace("0.06","0.12")} 0%,rgba(8,8,20,1) 100%)`, border: `1.5px solid ${border}` }}>

      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: border }}>
        <div className="flex items-center gap-3">
          <OsrsSprite srcs={spriteSrcs} fallback={char.emoji} size={52} />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-black text-white capitalize" style={{ fontFamily: "'Cinzel',serif", fontSize: "0.85rem" }}>{char.class_type}</p>
              <OsrsIcon src={armorSrc} fallback="" size={20} />
            </div>
            <p className={`text-xs capitalize font-bold osrs-label-${char.rarity}`}>{char.rarity_emoji} {char.rarity} · {TOKENS_DAY[char.rarity]?.toLocaleString()} gp/day</p>
          </div>
        </div>
        <div className="text-right">
          {isExpired
            ? <span className="text-red-400 font-black text-xs">EXPIRED</span>
            : <span className={`text-xs font-bold ${urgency ? "text-red-400" : "text-gray-500"}`}>{char.days_left}d {char.hours_left}h</span>
          }
          {char.is_staked && <p className="text-xs font-black" style={{ color: "#6dde6d" }}>● Fighting</p>}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {char.is_staked && (
          <div className="flex items-center justify-between rounded-xl px-3 py-2"
               style={{ background: "rgba(250,204,21,0.07)", border: "1px solid rgba(250,204,21,0.18)" }}>
            <div className="flex items-center gap-1.5">
              <OsrsIcon src={GAME_ICONS.gold[0]} fallback="🪙" size={14} />
              <span className="text-xs text-gray-400">Pending rewards</span>
            </div>
            <span className="text-yellow-400 font-black text-sm">+{fmtTokens(char.pending_tokens)}</span>
          </div>
        )}

        {char.equipped_items.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {char.equipped_items.map(i => (
              <span key={i.id} className="flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-bold"
                    style={{ background: "rgba(255,255,255,0.07)", color: "#d1d5db" }}>
                <OsrsIcon src={ITEM_SPRITES[i.item_type] ?? ""} fallback={i.icon} size={14} />
                {i.label}
              </span>
            ))}
          </div>
        )}

        {toast && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <div className="flex items-center justify-center gap-1.5">
              <OsrsIcon src={GAME_ICONS.gold[0]} fallback="🪙" size={18} />
              <p className="text-green-400 font-black text-sm">+{fmtTokens(toast.tokens)} gp</p>
            </div>
            {toast.items.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center pt-1 border-t border-green-900">
                {toast.items.map((d, i) => (
                  <div key={i} className="flex items-center gap-1 rounded-lg px-2 py-1"
                       style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)" }}>
                    <OsrsSprite srcs={CHEST_SPRITES.open} fallback="📦" size={20} pixelated={false} />
                    <span className="text-xs font-bold" style={{ color: "#ffcc00" }}>{d.label}</span>
                  </div>
                ))}
              </div>
            )}
            {expired && <p className="text-red-400 text-xs text-center">Character expired.</p>}
          </div>
        )}

        <div className="flex gap-2">
          {!char.is_staked && !isExpired && (
            <button onClick={handleStake} disabled={busy} className="osrs-btn-green flex-1 text-sm flex items-center justify-center gap-1.5">
              {busy ? "…" : (
                <>
                  <OsrsIcon src={GAME_ICONS.sword[0]} fallback="" size={14} />
                  Enter Dungeon
                </>
              )}
            </button>
          )}
          {char.is_staked && (
            <>
              <button onClick={handleClaim} disabled={busy} className="osrs-btn flex-1 text-sm flex items-center justify-center gap-1.5">
                {busy ? "…" : (
                  <>
                    <OsrsIcon src={GAME_ICONS.gold[0]} fallback="" size={14} />
                    Claim
                  </>
                )}
              </button>
              <button onClick={handleUnstake} disabled={busy} className="osrs-btn-red flex-1 text-sm flex items-center justify-center gap-1.5">
                {busy ? "…" : (
                  <>
                    <OsrsIcon src={GAME_ICONS.home[0]} fallback="" size={14} />
                    Retreat
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dungeon() {
  const { wallet, player, setPlayer } = useGameStore();
  const [loading,       setLoading]    = useState(false);
  const [claimingAll,   setClaimingAll] = useState(false);
  const [stakingAll,    setStakingAll]  = useState(false);
  const [claimAllToast, setClaimAllToast] = useState<{ tokens: number; items: CharacterItem[] } | null>(null);
  const [recentDrops,   setRecentDrops]  = useState<{ charName: string; items: CharacterItem[] }[]>([]);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try { const p = await getPlayer(wallet); setPlayer(p); }
    finally { setLoading(false); }
  }, [wallet, setPlayer]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!wallet) return <p className="text-center text-gray-500 py-20">Connect wallet first.</p>;

  const fighters = (player?.characters ?? []).filter(c => c.class_type !== "miner");
  const staked   = fighters.filter(c => c.is_staked);
  const idle     = fighters.filter(c => !c.is_staked && c.days_left > 0);
  const expired  = fighters.filter(c => !c.is_staked && c.days_left <= 0 && c.hours_left <= 0);

  const totalPending  = staked.reduce((s, c) => s + c.pending_tokens, 0);
  const gpPerDayStaked = staked.reduce((s, c) => s + (TOKENS_DAY[c.rarity] ?? 0), 0);
  const gpPerDayAll    = fighters.filter(c => c.days_left > 0 || c.hours_left > 0)
                                  .reduce((s, c) => s + (TOKENS_DAY[c.rarity] ?? 0), 0);

  async function handleClaimAll() {
    if (!wallet || staked.length === 0 || claimingAll) return;
    setClaimingAll(true);
    setClaimAllToast(null);
    try {
      const res = await claimAll(wallet, "fighter");
      setClaimAllToast({ tokens: res.tokens_claimed, items: res.items_dropped });
      const p = await getPlayer(wallet); setPlayer(p);
    } finally { setClaimingAll(false); }
  }

  async function handleStakeAll() {
    if (!wallet || idle.length === 0 || stakingAll) return;
    setStakingAll(true);
    try {
      await stakeAll(wallet, "fighter");
      const p = await getPlayer(wallet); setPlayer(p);
    } finally { setStakingAll(false); }
  }

  function handleChestDrop(charName: string, items: CharacterItem[]) {
    setRecentDrops(prev => [{ charName, items }, ...prev].slice(0, 10));
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <OsrsSprite srcs={GAME_ICONS.dungeon} fallback="🏰" size={36} pixelated={false} />
          <h1 className="text-2xl font-black" style={{ fontFamily:"'Cinzel',serif", color:"#ffcc00" }}>Dungeon</h1>
        </div>
        <button onClick={refresh} disabled={loading} className="text-xs transition-colors" style={{ color:"#a08040" }}>
          {loading ? "…" : "↺ Refresh"}
        </button>
      </div>

      {/* Summary + Calculator */}
      {fighters.length > 0 && (
        <div className="rounded-2xl px-5 py-4 space-y-3"
             style={{ background: "linear-gradient(135deg,rgba(34,197,94,0.08),rgba(8,8,20,1))", border: "1px solid rgba(34,197,94,0.2)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Fighters in dungeon</p>
              <p className="text-2xl font-black text-white">{staked.length}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Total pending</p>
              <p className="text-yellow-400 font-black text-lg">{fmtTokens(totalPending)}</p>
            </div>
          </div>

          {/* GP/day calculator */}
          {(() => {
            const bankPct   = player?.bank_boost_pct ?? 0;
            const boostedStaked = Math.round(gpPerDayStaked * (1 + bankPct / 100));
            const boostedAll    = Math.round(gpPerDayAll    * (1 + bankPct / 100));
            return (
              <div className="rounded-xl px-4 py-3 space-y-1"
                   style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(107,79,16,0.4)" }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "'Cinzel',serif", color: "#a08040", marginBottom: 6 }}>
                  💰 GP/Day Calculator
                </p>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "#6b7280" }}>Currently earning (staked)</span>
                  <span className="font-black" style={{ color: "#6dde6d" }}>{fmtTokens(gpPerDayStaked)}/day</span>
                </div>
                {bankPct > 0 && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "#6b7280" }}>Bank bonus</span>
                    <span className="font-black" style={{ color: "#60a5fa" }}>+{bankPct}%</span>
                  </div>
                )}
                {bankPct > 0 && staked.length > 0 && (
                  <div className="flex justify-between text-xs pt-1 border-t" style={{ borderColor: "rgba(107,79,16,0.3)" }}>
                    <span style={{ color: "#fbbf24", fontWeight: 700 }}>With bank boost</span>
                    <span className="font-black" style={{ color: "#fbbf24" }}>{fmtTokens(boostedStaked)}/day</span>
                  </div>
                )}
                <div className="flex justify-between text-xs" style={{ paddingTop: bankPct > 0 ? 0 : 0 }}>
                  <span style={{ color: "#6b7280" }}>If all fighters staked{bankPct > 0 ? " + boost" : ""}</span>
                  <span className="font-black" style={{ color: "#ffcc00" }}>{fmtTokens(bankPct > 0 ? boostedAll : gpPerDayAll)}/day</span>
                </div>
                {idle.length > 0 && (
                  <div className="flex justify-between text-xs pt-1 border-t" style={{ borderColor: "rgba(107,79,16,0.3)" }}>
                    <span style={{ color: "#6b7280" }}>Idle fighters missing out</span>
                    <span className="font-black" style={{ color: "#ef4444" }}>
                      -{fmtTokens(idle.reduce((s, c) => s + (TOKENS_DAY[c.rarity] ?? 0), 0))}/day
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Claim All toast */}
          {claimAllToast && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                 style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <OsrsIcon src={GAME_ICONS.gold[0]} fallback="🪙" size={22} />
              <div>
                <p className="text-green-400 font-black text-sm">+{fmtTokens(claimAllToast.tokens)} gp collected!</p>
                {claimAllToast.items.length > 0 && (
                  <p className="text-xs" style={{ color: "#ffcc00" }}>
                    {claimAllToast.items.length} item{claimAllToast.items.length > 1 ? "s" : ""} dropped
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Bulk actions */}
          <div className="flex gap-2">
            {staked.length > 0 && (
              <button onClick={handleClaimAll} disabled={claimingAll}
                      className="osrs-btn flex-1 text-sm flex items-center justify-center gap-1.5">
                {claimingAll ? "Claiming…" : (
                  <>
                    <OsrsIcon src={GAME_ICONS.gold[0]} fallback="🪙" size={14} />
                    Claim All ({staked.length})
                  </>
                )}
              </button>
            )}
            {idle.length > 0 && (
              <button onClick={handleStakeAll} disabled={stakingAll}
                      className="osrs-btn-green flex-1 text-sm flex items-center justify-center gap-1.5">
                {stakingAll ? "Staking…" : (
                  <>
                    <OsrsIcon src={GAME_ICONS.sword[0]} fallback="⚔" size={14} />
                    Stake All ({idle.length})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {fighters.length === 0 && (
        <div className="text-center py-16 text-gray-600 flex flex-col items-center gap-3">
          <OsrsSprite srcs={GAME_ICONS.dungeon} fallback="" size={56} pixelated={false} />
          <p>No fighters yet.<br />Mint an Archer, Warrior or Mage!</p>
        </div>
      )}

      {staked.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold text-green-400 uppercase tracking-widest">In Dungeon ({staked.length})</p>
          {staked.map(c => (
            <FighterCard key={c.id} char={c} wallet={wallet} onRefresh={refresh}
              onChestDrop={items => handleChestDrop(`${c.class_type} (${c.rarity})`, items)} />
          ))}
        </section>
      )}

      {idle.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ready ({idle.length})</p>
          {idle.map(c => (
            <FighterCard key={c.id} char={c} wallet={wallet} onRefresh={refresh}
              onChestDrop={items => handleChestDrop(`${c.class_type} (${c.rarity})`, items)} />
          ))}
        </section>
      )}

      {expired.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Expired ({expired.length})</p>
          {expired.map(c => (
            <FighterCard key={c.id} char={c} wallet={wallet} onRefresh={refresh}
              onChestDrop={items => handleChestDrop(`${c.class_type} (${c.rarity})`, items)} />
          ))}
        </section>
      )}

      {recentDrops.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <OsrsSprite srcs={CHEST_SPRITES.open} fallback="📦" size={20} pixelated={false} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#ffcc00" }}>
              Chests Dropped This Session
            </p>
          </div>
          <div className="space-y-2">
            {recentDrops.map((drop, i) => (
              <div key={i} className="rounded-xl px-3 py-2 flex items-center gap-3"
                   style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)" }}>
                <OsrsSprite srcs={CHEST_SPRITES.open} fallback="📦" size={28} pixelated={false} />
                <div className="flex-1">
                  <p className="text-xs font-bold capitalize" style={{ color: "#ffe8a0" }}>{drop.charName}</p>
                  <p className="text-xs" style={{ color: "#a08040" }}>
                    {drop.items.map(it => it.label).join(", ")}
                  </p>
                </div>
                <OsrsIcon src={GAME_ICONS.chest[0]} fallback="" size={16} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
