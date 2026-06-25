import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "../store";
import { getPlayer, bankStake, bankUnstake } from "../api";
import { OsrsSprite, OsrsIcon } from "../components/OsrsSprite";
import { GAME_ICONS } from "../sprites";

const W = "https://oldschool.runescape.wiki/w/Special:FilePath";

const BANKER_SPRITES  = [`${W}/Banker_chathead.png`, `${W}/Bank_teller_chathead.png`, `${W}/Hans_chathead.png`];
const BANK_BOOTH      = [`${W}/Bank_booth_(Varrock).png`, `${W}/Bank_chest_(POH).png`, `${W}/Closed_chest.png`];

const BOOST_TIERS = [
  { millions: 1,  boost: 10  },
  { millions: 2,  boost: 20  },
  { millions: 3,  boost: 30  },
  { millions: 4,  boost: 40  },
  { millions: 5,  boost: 50  },
  { millions: 6,  boost: 60  },
  { millions: 7,  boost: 70  },
  { millions: 8,  boost: 80  },
  { millions: 9,  boost: 90  },
  { millions: 10, boost: 100 },
];

const BANKER_LINES = [
  "Welcome back, adventurer! Would you like to deposit some gold?",
  "Your gold is safe with us. The more you deposit, the bigger the bonus!",
  "Fancy a boost to your mining and dungeon earnings? Deposit gold!",
  "Hello! I can lock your gold away and give you a production boost in return.",
  "The bank always keeps your coin safe. Leave it with us for 7 days!",
];

function fmtGold(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function useCountdown(untilIso: string | null) {
  const [remaining, setRemaining] = useState<{ days: number; hours: number; mins: number; expired: boolean }>({ days: 0, hours: 0, mins: 0, expired: true });

  useEffect(() => {
    function calc() {
      if (!untilIso) { setRemaining({ days: 0, hours: 0, mins: 0, expired: true }); return; }
      const diff = new Date(untilIso).getTime() - Date.now();
      if (diff <= 0) { setRemaining({ days: 0, hours: 0, mins: 0, expired: true }); return; }
      const days  = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins  = Math.floor((diff % 3600000)  / 60000);
      setRemaining({ days, hours, mins, expired: false });
    }
    calc();
    const t = setInterval(calc, 30_000);
    return () => clearInterval(t);
  }, [untilIso]);

  return remaining;
}

export default function Bank() {
  const { wallet, player, setPlayer } = useGameStore();
  const [loading,   setLoading]   = useState(false);
  const [staking,   setStaking]   = useState(false);
  const [unstaking, setUnstaking] = useState(false);
  const [amount,    setAmount]    = useState("");
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState("");
  const [bankerLine] = useState(() => BANKER_LINES[Math.floor(Math.random() * BANKER_LINES.length)]);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try { const p = await getPlayer(wallet); setPlayer(p); }
    finally { setLoading(false); }
  }, [wallet, setPlayer]);

  useEffect(() => { refresh(); }, [refresh]);

  const countdown = useCountdown(player?.staked_gold_until ?? null);

  if (!wallet) return <p className="text-center text-gray-500 py-20">Connect wallet first.</p>;

  const stakedGold   = player?.staked_gold ?? 0;
  const boostPct     = player?.bank_boost_pct ?? 0;
  const gold         = player?.tokens ?? 0;
  const isLocked     = !countdown.expired && stakedGold > 0;
  const progress     = Math.min(stakedGold / 10_000_000, 1); // 0–1 for 0–10M
  const currentTier  = Math.floor(stakedGold / 1_000_000);
  const nextMilestone = (currentTier + 1) * 1_000_000;
  const toNextTier   = currentTier < 10 ? nextMilestone - stakedGold : 0;

  async function handleStake() {
    const amt = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (!wallet || isNaN(amt) || amt <= 0) { setError("Enter a valid amount."); return; }
    if (amt > gold) { setError(`Not enough Gold (you have ${fmtGold(gold)} gp).`); return; }
    setError(""); setSuccess(""); setStaking(true);
    try {
      await bankStake(wallet, amt);
      const p = await getPlayer(wallet); setPlayer(p);
      setAmount("");
      setSuccess(`${fmtGold(amt)} gp deposited! Lock reset to 7 days.`);
    } catch (e: unknown) {
      const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(d ?? "Stake failed");
    } finally { setStaking(false); }
  }

  async function handleUnstake() {
    if (!wallet || unstaking) return;
    setError(""); setSuccess(""); setUnstaking(true);
    try {
      const res = await bankUnstake(wallet);
      const p = await getPlayer(wallet); setPlayer(p);
      setSuccess(`${fmtGold(stakedGold)} gp withdrawn to your wallet!`);
      void res;
    } catch (e: unknown) {
      const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(d ?? "Unstake failed");
    } finally { setUnstaking(false); }
  }

  function setPreset(pct: number) {
    const val = Math.floor(gold * pct);
    setAmount(val.toString());
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <OsrsSprite srcs={BANK_BOOTH} fallback="🏦" size={36} pixelated={false} />
          <h1 className="text-2xl font-black" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00" }}>Bank</h1>
        </div>
        <button onClick={refresh} disabled={loading} className="text-xs" style={{ color: "#a08040" }}>
          {loading ? "…" : "↺ Refresh"}
        </button>
      </div>

      {/* Banker NPC dialogue */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(160deg,rgba(60,40,0,0.6),rgba(8,5,0,1))", border: "1.5px solid rgba(251,191,36,0.35)" }}>
        <div className="flex items-start gap-4 p-4">
          <div style={{ flexShrink: 0 }}>
            <OsrsSprite srcs={BANKER_SPRITES} fallback="🧑‍💼" size={64} pixelated={false} />
          </div>
          <div className="flex-1">
            <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontWeight: 700, fontSize: "0.75rem", marginBottom: 6 }}>
              Banker
            </p>
            {/* RS-style dialogue box */}
            <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(107,79,16,0.5)" }}>
              <p style={{ color: "#ffe8a0", fontSize: "0.75rem", lineHeight: 1.7, fontStyle: "italic" }}>
                "{bankerLine}"
              </p>
            </div>
          </div>
        </div>

        {/* Boost bar */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-1">
            <p style={{ fontFamily: "'Cinzel',serif", color: "#a08040", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Staking Boost
            </p>
            <p style={{ fontFamily: "'Cinzel',serif", color: boostPct > 0 ? "#6dde6d" : "#6b7280", fontWeight: 900, fontSize: "0.8rem" }}>
              +{boostPct}%
            </p>
          </div>
          <div style={{ height: 10, borderRadius: 99, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(107,79,16,0.4)", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${progress * 100}%`,
              background: boostPct >= 100
                ? "linear-gradient(90deg,#fbbf24,#f59e0b)"
                : "linear-gradient(90deg,#22c55e,#16a34a)",
              borderRadius: 99, transition: "width 0.6s ease",
            }} />
          </div>
          <div className="flex justify-between mt-1">
            <p style={{ color: "#6b4f10", fontSize: "0.55rem" }}>0</p>
            <p style={{ color: "#6b4f10", fontSize: "0.55rem" }}>5M (+50%)</p>
            <p style={{ color: "#ffcc00", fontSize: "0.55rem" }}>10M (+100%)</p>
          </div>
        </div>
      </div>

      {/* Staked gold status */}
      <div className="rounded-2xl px-5 py-4 space-y-3"
           style={{ background: "linear-gradient(135deg,rgba(251,191,36,0.08),rgba(8,5,0,1))", border: "1px solid rgba(251,191,36,0.25)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Gold in Bank</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <OsrsIcon src={GAME_ICONS.gold[0]} fallback="🪙" size={18} />
              <p className="font-black text-xl" style={{ color: stakedGold > 0 ? "#ffcc00" : "#4a3820" }}>
                {fmtGold(stakedGold)} gp
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">{boostPct >= 100 ? "MAX BOOST" : "Current Boost"}</p>
            <p className="font-black text-xl" style={{ color: boostPct >= 100 ? "#fbbf24" : boostPct > 0 ? "#6dde6d" : "#4a3820" }}>
              +{boostPct}%
            </p>
            <p style={{ color: "#6b7280", fontSize: "0.6rem" }}>mining & dungeon</p>
          </div>
        </div>

        {/* Lock timer */}
        {stakedGold > 0 && (
          <div className="rounded-xl px-3 py-2.5 flex items-center justify-between"
               style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${isLocked ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}` }}>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 18 }}>{isLocked ? "🔒" : "🔓"}</span>
              <div>
                <p style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", color: isLocked ? "#ef4444" : "#6dde6d", fontWeight: 700 }}>
                  {isLocked ? "LOCKED" : "UNLOCKED"}
                </p>
                <p style={{ color: "#6b7280", fontSize: "0.6rem" }}>
                  {isLocked
                    ? `${countdown.days}d ${countdown.hours}h ${countdown.mins}m remaining`
                    : "Ready to withdraw"}
                </p>
              </div>
            </div>
            {!isLocked && stakedGold > 0 && (
              <button onClick={handleUnstake} disabled={unstaking}
                      className="osrs-btn-green text-xs px-3 py-1.5">
                {unstaking ? "…" : "Withdraw"}
              </button>
            )}
          </div>
        )}

        {/* Next tier info */}
        {currentTier < 10 && stakedGold > 0 && (
          <p style={{ color: "#a08040", fontSize: "0.68rem", textAlign: "center" }}>
            Deposit <strong style={{ color: "#ffcc00" }}>{fmtGold(toNextTier)} more</strong> to reach +{(currentTier + 1) * 10}% boost
          </p>
        )}
        {boostPct >= 100 && (
          <p style={{ color: "#fbbf24", fontSize: "0.72rem", textAlign: "center", fontWeight: 700 }}>
            ✦ Maximum boost reached — your production is doubled! ✦
          </p>
        )}
      </div>

      {/* Deposit form */}
      <div className="rounded-2xl px-5 py-4 space-y-4"
           style={{ background: "rgba(10,6,0,0.9)", border: "1px solid rgba(107,79,16,0.4)" }}>
        <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontWeight: 700, fontSize: "0.8rem", borderBottom: "1px solid rgba(107,79,16,0.3)", paddingBottom: 8 }}>
          Deposit Gold
        </p>

        <div className="flex items-center gap-2 rounded-xl px-3 py-2"
             style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(107,79,16,0.35)" }}>
          <OsrsIcon src={GAME_ICONS.gold[0]} fallback="🪙" size={16} />
          <span style={{ color: "#a08040", fontSize: "0.75rem" }}>Wallet:</span>
          <span style={{ color: "#ffcc00", fontWeight: 700, fontFamily: "'Cinzel',serif", fontSize: "0.8rem", flex: 1 }}>
            {fmtGold(gold)} gp
          </span>
        </div>

        {/* Preset buttons */}
        <div className="flex gap-2">
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <button key={pct} onClick={() => setPreset(pct)}
                    className="flex-1 rounded-xl py-1.5 text-xs font-bold transition-colors"
                    style={{ background: "rgba(107,79,16,0.2)", border: "1px solid rgba(107,79,16,0.35)", color: "#a08040" }}>
              {pct === 1 ? "Max" : `${pct * 100}%`}
            </button>
          ))}
        </div>

        {/* Amount input */}
        <div className="space-y-2">
          <input
            type="number"
            placeholder="Amount (gp)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min={1}
            max={gold}
            className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none"
            style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(107,79,16,0.5)", color: "#ffe8a0", fontFamily: "'Cinzel',serif" }}
          />

          {error   && <p className="text-red-400 text-xs text-center">{error}</p>}
          {success && <p className="text-green-400 text-xs text-center">{success}</p>}

          <button onClick={handleStake} disabled={staking || !amount}
                  className={amount && !staking ? "osrs-btn-green w-full py-3 text-sm" : "w-full py-3 rounded-xl font-black text-sm"}
                  style={!amount || staking ? { background: "rgba(107,114,128,0.15)", border: "1px solid rgba(107,114,128,0.25)", color: "#6b7280", cursor: "not-allowed" } : {}}>
            {staking ? "Depositing…" : `🏦 Deposit${amount ? ` ${fmtGold(parseInt(amount) || 0)} gp` : ""}`}
          </button>
          <p style={{ color: "#6b4f10", fontSize: "0.62rem", textAlign: "center" }}>
            Each deposit resets the 7-day lock on your entire balance.
          </p>
        </div>
      </div>

      {/* Boost tiers table */}
      <div className="osrs-panel overflow-hidden">
        <div className="px-4 py-2 flex items-center gap-2"
             style={{ borderBottom: "1px solid #6b4f10" }}>
          <OsrsSprite srcs={GAME_ICONS.gold} fallback="🪙" size={18} pixelated={false} />
          <p style={{ fontFamily: "'Cinzel',serif", color: "#a08040", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Boost Tiers
          </p>
        </div>
        <div className="grid grid-cols-2">
          {BOOST_TIERS.map((tier, i) => {
            const reached = stakedGold >= tier.millions * 1_000_000;
            return (
              <div key={tier.millions}
                   className="flex items-center justify-between px-4 py-2"
                   style={{
                     borderBottom: i < BOOST_TIERS.length - 2 ? "1px solid rgba(107,79,16,0.2)" : "none",
                     borderRight:  i % 2 === 0 ? "1px solid rgba(107,79,16,0.2)" : "none",
                     background:   reached ? "rgba(255,204,0,0.04)" : "transparent",
                   }}>
                <span style={{ color: reached ? "#ffcc00" : "#4a3820", fontSize: "0.72rem", fontFamily: "'Cinzel',serif" }}>
                  {reached ? "✦ " : ""}{tier.millions}M gp
                </span>
                <span style={{ color: reached ? "#6dde6d" : "#4a3820", fontWeight: 700, fontSize: "0.72rem" }}>
                  +{tier.boost}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl px-4 py-3 space-y-1.5"
           style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(107,79,16,0.25)" }}>
        <p style={{ fontFamily: "'Cinzel',serif", color: "#a08040", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          How it works
        </p>
        <div className="space-y-1" style={{ color: "#4a3820", fontSize: "0.7rem", lineHeight: 1.7 }}>
          <p>🏦 Deposit Gold into the bank to earn a permanent GP boost</p>
          <p>⏱ Each deposit locks your <em>entire</em> balance for 7 days from that moment</p>
          <p>📈 Every 1,000,000 gp staked = +10% to mining & dungeon earnings</p>
          <p>🏆 Maximum: 10M gp staked = +100% (doubles all GP production)</p>
          <p>💰 Withdrawing returns all gold — but removes the boost entirely</p>
        </div>
      </div>
    </div>
  );
}
