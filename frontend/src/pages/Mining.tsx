import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "../store";
import { getPlayer, stakeChar, unstakeChar, claimTokens, claimAll, stakeAll, upgradeMiner } from "../api";
import type { Character } from "../api";
import { OsrsSprite, OsrsIcon } from "../components/OsrsSprite";
import { CHAR_SPRITES, ARMOR_ICONS, GAME_ICONS } from "../sprites";

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
  common: 12000, rare: 17000, epic: 23000, legendary: 30000,
};
const UPGRADE_STONES: Record<string, number> = {
  common: 1, rare: 2, epic: 5,
};
const RARITY_NEXT: Record<string, string> = {
  common: "Rare", rare: "Epic", epic: "Legendary",
};

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function MinerCard({ char, wallet, ownedStones, onRefresh }: {
  char: Character; wallet: string; ownedStones: number; onRefresh: () => void;
}) {
  const [busy, setBusy]           = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [claimed, setClaimed]     = useState<number | null>(null);
  const [expired, setExpired]     = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);
  const { setPlayer }             = useGameStore();

  const border = RARITY_BORDER[char.rarity];
  const bg     = RARITY_BG[char.rarity];
  const isExpired = char.days_left <= 0 && char.hours_left <= 0;
  const urgency   = char.days_left <= 3 && !isExpired;
  const spriteSrcs = CHAR_SPRITES["miner"]?.[char.rarity] ?? [];
  const pickaxeSrc = ARMOR_ICONS["miner"]?.[char.rarity] ?? "";

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
      setClaimed(res.tokens_claimed);
      const p = await getPlayer(wallet); setPlayer(p); onRefresh();
    } finally { setBusy(false); }
  }

  async function handleClaim() {
    setBusy(true);
    try {
      const res = await claimTokens(wallet, char.id);
      setClaimed(res.tokens_claimed);
      if (res.expired) setExpired(true);
      const p = await getPlayer(wallet); setPlayer(p); onRefresh();
    } finally { setBusy(false); }
  }

  async function handleUpgrade() {
    setUpgrading(true);
    setUpgradeMsg(null);
    try {
      const res = await upgradeMiner(wallet, char.id);
      setUpgradeMsg(`Upgraded to ${res.new_rarity}!`);
      const p = await getPlayer(wallet); setPlayer(p); onRefresh();
    } catch (e: unknown) {
      const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setUpgradeMsg(d ?? "Upgrade failed");
    } finally { setUpgrading(false); }
  }

  const stonesNeeded = UPGRADE_STONES[char.rarity] ?? 0;
  const canUpgrade   = stonesNeeded > 0 && ownedStones >= stonesNeeded && !char.is_staked;

  return (
    <div className="rounded-2xl overflow-hidden"
         style={{ background: `linear-gradient(160deg,${bg.replace("0.06","0.12")} 0%,rgba(8,8,20,1) 100%)`, border: `1.5px solid ${border}` }}>

      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: border }}>
        <div className="flex items-center gap-3">
          <OsrsSprite srcs={spriteSrcs} fallback={char.emoji} size={52} />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-black text-white capitalize" style={{ fontFamily: "'Cinzel',serif", fontSize: "0.85rem" }}>Miner</p>
              <OsrsIcon src={pickaxeSrc} fallback="⛏️" size={20} />
            </div>
            <p className={`text-xs capitalize font-bold osrs-label-${char.rarity}`}>
              {char.rarity_emoji} {char.is_starter ? "Starter" : char.rarity} · {char.is_starter ? "100" : TOKENS_DAY[char.rarity]?.toLocaleString()} gp/day
            </p>
          </div>
        </div>
        <div className="text-right">
          {isExpired
            ? <span className="text-red-400 font-black text-xs">EXPIRED</span>
            : <span className={`text-xs font-bold ${urgency ? "text-red-400" : "text-gray-500"}`}>{char.days_left}d {char.hours_left}h</span>
          }
          {char.is_staked && <p className="text-amber-400 text-xs font-black">● Mining</p>}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {char.is_staked && (
          <div className="flex items-center justify-between rounded-xl px-3 py-2"
               style={{ background: "rgba(180,83,9,0.1)", border: "1px solid rgba(180,83,9,0.25)" }}>
            <span className="text-xs text-gray-400">⛏️ Mined so far</span>
            <span className="text-amber-400 font-black text-sm">+{fmtTokens(char.pending_tokens)}</span>
          </div>
        )}

        {claimed !== null && (
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <p className="text-green-400 font-black text-sm">+{fmtTokens(claimed)} tokens mined!</p>
            {expired && <p className="text-red-400 text-xs mt-1">Miner expired.</p>}
          </div>
        )}

        <p className="text-xs text-gray-600">⛏️ Miners drop Upgrade Stones while mining — collect to evolve them.</p>

        {/* Upgrade panel — shown when not staked and not legendary */}
        {char.rarity !== "legendary" && (
          <div className="rounded-xl px-3 py-2.5 space-y-2"
               style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(107,79,16,0.35)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "0.65rem" }}>
                  Upgrade → {RARITY_NEXT[char.rarity]}
                </p>
                <p className="text-xs mt-0.5" style={{ color: RARITY_COLOR[RARITY_NEXT[char.rarity]?.toLowerCase() ?? "common"] }}>
                  {RARITY_NEXT[char.rarity]}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black" style={{ color: ownedStones >= stonesNeeded ? "#6dde6d" : "#ef4444" }}>
                  🪨 {ownedStones} / {stonesNeeded}
                </p>
                <p className="text-xs" style={{ color: "#6b7280" }}>Upgrade Stones</p>
              </div>
            </div>
            {upgradeMsg && (
              <p className="text-xs text-center font-bold"
                 style={{ color: upgradeMsg.startsWith("Upgraded") ? "#6dde6d" : "#ef4444" }}>
                {upgradeMsg}
              </p>
            )}
            <button
              onClick={handleUpgrade}
              disabled={!canUpgrade || upgrading}
              className={canUpgrade && !upgrading ? "osrs-btn-green w-full text-sm" : "w-full text-sm rounded-xl py-2 font-black"}
              style={!canUpgrade || upgrading ? { background: "rgba(107,114,128,0.15)", border: "1px solid rgba(107,114,128,0.25)", color: "#6b7280", cursor: "not-allowed" } : {}}>
              {upgrading ? "Upgrading…" : char.is_staked ? "Stop mining to upgrade" : canUpgrade ? `⬆ Upgrade (use ${stonesNeeded} stone${stonesNeeded > 1 ? "s" : ""})` : `Need ${stonesNeeded} stone${stonesNeeded > 1 ? "s" : ""} (have ${ownedStones})`}
            </button>
          </div>
        )}

        {char.rarity === "legendary" && (
          <div className="rounded-xl px-3 py-2 text-center"
               style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
            <p className="text-xs font-black" style={{ color: "#fbbf24" }}>🟡 Max Rarity — Legendary</p>
          </div>
        )}

        <div className="flex gap-2">
          {!char.is_staked && !isExpired && (
            <button onClick={handleStake} disabled={busy} className="osrs-btn-green flex-1 text-sm">
              {busy ? "…" : "⛏ Start Mining"}
            </button>
          )}
          {char.is_staked && (
            <>
              <button onClick={handleClaim}   disabled={busy} className="osrs-btn flex-1 text-sm">{busy ? "…" : "💰 Collect"}</button>
              <button onClick={handleUnstake} disabled={busy} className="osrs-btn-red flex-1 text-sm">{busy ? "…" : "🛑 Stop"}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Mining() {
  const { wallet, player, setPlayer } = useGameStore();
  const [loading,       setLoading]    = useState(false);
  const [claimingAll,   setClaimingAll] = useState(false);
  const [stakingAll,    setStakingAll]  = useState(false);
  const [claimAllToast, setClaimAllToast] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try { const p = await getPlayer(wallet); setPlayer(p); }
    finally { setLoading(false); }
  }, [wallet, setPlayer]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!wallet) return <p className="text-center text-gray-500 py-20">Connect wallet first.</p>;

  const miners      = (player?.characters ?? []).filter(c => c.class_type === "miner");
  const staked      = miners.filter(c => c.is_staked);
  const idle        = miners.filter(c => !c.is_staked && c.days_left > 0);
  const expired     = miners.filter(c => !c.is_staked && c.days_left <= 0 && c.hours_left <= 0);
  const ownedStones = (player?.inventory ?? []).filter(i => i.item_type === "upgrade_stone").length;

  const minerRate      = (c: { rarity: string; is_starter: boolean }) => c.is_starter ? 100 : (TOKENS_DAY[c.rarity] ?? 0);
  const totalPending   = staked.reduce((s, c) => s + c.pending_tokens, 0);
  const gpPerDayStaked = staked.reduce((s, c) => s + minerRate(c), 0);
  const gpPerDayAll    = miners.filter(c => c.days_left > 0 || c.hours_left > 0)
                                .reduce((s, c) => s + minerRate(c), 0);

  async function handleClaimAll() {
    if (!wallet || staked.length === 0 || claimingAll) return;
    setClaimingAll(true);
    setClaimAllToast(null);
    try {
      const res = await claimAll(wallet, "miner");
      setClaimAllToast(res.tokens_claimed);
      const p = await getPlayer(wallet); setPlayer(p);
    } finally { setClaimingAll(false); }
  }

  async function handleStakeAll() {
    if (!wallet || idle.length === 0 || stakingAll) return;
    setStakingAll(true);
    try {
      await stakeAll(wallet, "miner");
      const p = await getPlayer(wallet); setPlayer(p);
    } finally { setStakingAll(false); }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <OsrsSprite srcs={GAME_ICONS.mining} fallback="⛏" size={36} pixelated={false} />
          <h1 className="text-2xl font-black" style={{ fontFamily:"'Cinzel',serif", color:"#ffcc00" }}>Mining</h1>
        </div>
        <button onClick={refresh} disabled={loading} className="text-xs transition-colors" style={{ color:"#a08040" }}>
          {loading ? "…" : "↺ Refresh"}
        </button>
      </div>

      {/* Summary + Calculator */}
      {miners.length > 0 && (
        <div className="rounded-2xl px-5 py-4 space-y-3"
             style={{ background: "linear-gradient(135deg,rgba(180,83,9,0.12),rgba(8,8,20,1))", border: "1px solid rgba(251,146,60,0.2)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Miners active</p>
              <p className="text-2xl font-black text-white">{staked.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Upgrade Stones</p>
              <p className="font-black text-lg" style={{ color: ownedStones > 0 ? "#fbbf24" : "#6b7280" }}>
                🪨 {ownedStones}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Total mined</p>
              <p className="text-amber-400 font-black text-lg">{fmtTokens(totalPending)}</p>
            </div>
          </div>

          {/* GP/day calculator */}
          {(() => {
            const bankPct      = player?.bank_boost_pct ?? 0;
            const boostedStaked = Math.round(gpPerDayStaked * (1 + bankPct / 100));
            const boostedAll    = Math.round(gpPerDayAll    * (1 + bankPct / 100));
            return (
              <div className="rounded-xl px-4 py-3 space-y-1"
                   style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(107,79,16,0.4)" }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "'Cinzel',serif", color: "#a08040", marginBottom: 6 }}>
                  ⛏ GP/Day Calculator
                </p>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "#6b7280" }}>Currently mining (staked)</span>
                  <span className="font-black" style={{ color: "#fbbf24" }}>{fmtTokens(gpPerDayStaked)}/day</span>
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
                <div className="flex justify-between text-xs">
                  <span style={{ color: "#6b7280" }}>If all miners staked{bankPct > 0 ? " + boost" : ""}</span>
                  <span className="font-black" style={{ color: "#ffcc00" }}>{fmtTokens(bankPct > 0 ? boostedAll : gpPerDayAll)}/day</span>
                </div>
                {idle.length > 0 && (
                  <div className="flex justify-between text-xs pt-1 border-t" style={{ borderColor: "rgba(107,79,16,0.3)" }}>
                    <span style={{ color: "#6b7280" }}>Idle miners missing out</span>
                    <span className="font-black" style={{ color: "#ef4444" }}>
                      -{fmtTokens(idle.reduce((s, c) => s + minerRate(c), 0))}/day
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Claim all toast */}
          {claimAllToast !== null && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                 style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <OsrsIcon src={GAME_ICONS.gold[0]} fallback="🪙" size={22} />
              <p className="text-green-400 font-black text-sm">+{fmtTokens(claimAllToast)} gp collected!</p>
            </div>
          )}

          {/* Bulk actions */}
          <div className="flex gap-2">
            {staked.length > 0 && (
              <button onClick={handleClaimAll} disabled={claimingAll}
                      className="osrs-btn flex-1 text-sm flex items-center justify-center gap-1.5">
                {claimingAll ? "Collecting…" : `💰 Collect All (${staked.length})`}
              </button>
            )}
            {idle.length > 0 && (
              <button onClick={handleStakeAll} disabled={stakingAll}
                      className="osrs-btn-green flex-1 text-sm flex items-center justify-center gap-1.5">
                {stakingAll ? "Starting…" : `⛏ Mine All (${idle.length})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rates table */}
      <div className="osrs-panel overflow-hidden">
        <div className="px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "'Cinzel',serif", color: "#a08040", borderBottom: "1px solid #6b4f10" }}>
          Mining Rates
        </div>
        {[
          ["⬜ Common","12k","common"],
          ["🔵 Rare","17k","rare"],
          ["🟣 Epic","23k","epic"],
          ["🟡 Legendary","30k","legendary"],
        ].map(([r, t, cls]) => (
          <div key={r} className="flex justify-between px-4 py-2 text-sm border-t" style={{ borderColor: "rgba(107,79,16,0.3)" }}>
            <span className={`osrs-label-${cls}`}>{r}</span>
            <span className="font-black" style={{ color: "#ffcc00" }}>{t}/day</span>
          </div>
        ))}
      </div>

      {miners.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-5xl mb-3">⛏️</p>
          <p>No miners yet.<br />Mint a box — there's a 25% chance of getting a Miner!</p>
        </div>
      )}

      {staked.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Mining ({staked.length})</p>
          {staked.map(c => <MinerCard key={c.id} char={c} wallet={wallet} ownedStones={ownedStones} onRefresh={refresh} />)}
        </section>
      )}

      {idle.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ready ({idle.length})</p>
          {idle.map(c => <MinerCard key={c.id} char={c} wallet={wallet} ownedStones={ownedStones} onRefresh={refresh} />)}
        </section>
      )}

      {expired.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Expired ({expired.length})</p>
          {expired.map(c => <MinerCard key={c.id} char={c} wallet={wallet} ownedStones={ownedStones} onRefresh={refresh} />)}
        </section>
      )}
    </div>
  );
}
