import { Routes, Route, NavLink } from "react-router-dom";
import { useState } from "react";
import { useGameStore } from "./store";
import Home from "./pages/Home";
import Characters from "./pages/Characters";
import Mint from "./pages/Mint";
import Inventory from "./pages/Inventory";
import Dungeon from "./pages/Dungeon";
import Mining from "./pages/Mining";
import Skills from "./pages/Skills";
import Heroes from "./pages/Heroes";
import Shop from "./pages/Shop";
import Wiki from "./pages/Wiki";
import Bank from "./pages/Bank";
import History from "./pages/History";
import BattleRoyale from "./pages/BattleRoyale";
import { OsrsSprite, OsrsIcon } from "./components/OsrsSprite";
import { GAME_ICONS, RUNEX_ICON } from "./sprites";
import { withdrawRunex, getPlayer } from "./api";

const NAV = [
  { to: "/",           label: "Home"      },
  { to: "/shop",       label: "Shop"      },
  { to: "/mint",       label: "Mint"      },
  { to: "/characters", label: "Equip"     },
  { to: "/dungeon",    label: "Dungeon"   },
  { to: "/mining",     label: "Mining"    },
  { to: "/heroes",     label: "Heroes"    },
  { to: "/skills",     label: "Skills"    },
  { to: "/inventory",  label: "Inventory" },
  { to: "/bank",       label: "Bank"      },
  { to: "/wiki",       label: "Wiki"      },
  { to: "/history",   label: "History"   },
  { to: "/royale",    label: "Royale"    },
];

export default function App() {
  const { wallet, player, setPlayer } = useGameStore();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmt,  setWithdrawAmt]  = useState("");
  const [withdrawing,  setWithdrawing]  = useState(false);
  const [withdrawMsg,  setWithdrawMsg]  = useState<{ ok: boolean; text: string } | null>(null);

  const wrunex = player?.wrunex ?? 0;

  async function handleWithdraw() {
    const amt = parseFloat(withdrawAmt);
    if (!wallet || !amt || amt < 100 || withdrawing) return;
    setWithdrawing(true);
    setWithdrawMsg(null);
    try {
      const res = await withdrawRunex(wallet, amt);
      const p   = await getPlayer(wallet);
      setPlayer(p);
      setWithdrawMsg({ ok: true, text: `${amt.toLocaleString()} RuneX sent! Tx: ${res.signature.slice(0, 12)}…` });
      setWithdrawAmt("");
    } catch (e: unknown) {
      const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setWithdrawMsg({ ok: false, text: d ?? "Withdraw failed" });
    } finally { setWithdrawing(false); }
  }

  return (
    <div className="min-h-screen" style={{ background: "#1a0e00" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-50 px-4 py-2 flex items-center justify-between"
              style={{ background: "linear-gradient(180deg,#2a1f08,#1a1200)", borderBottom: "2px solid #6b4f10",
                       boxShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
        <span style={{ fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: "1.1rem", color: "#ffcc00",
                       textShadow: "0 0 12px rgba(255,204,0,0.4)" }}>
          ⚔ RuneX
        </span>
        {wallet && (
          <div className="flex items-center gap-2">
            {/* Gold */}
            <div className="flex items-center gap-1">
              <OsrsIcon src={GAME_ICONS.gold[0]} fallback="🪙" size={16} />
              <span style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontWeight: 700, fontSize: "0.8rem" }}>
                {(player?.tokens ?? 0).toLocaleString()}
              </span>
            </div>
            <span style={{ color: "#a08040", fontSize: "0.7rem" }}>
              {wallet.slice(0, 4)}…{wallet.slice(-4)}
            </span>
            {/* wRuneX + Withdraw — grouped with Exit */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setShowWithdraw(v => !v); setWithdrawMsg(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: "0.65rem", padding: "3px 8px", borderRadius: 6, cursor: "pointer",
                  border: "1px solid rgba(255,96,96,0.35)", background: "rgba(255,96,96,0.07)",
                  color: "#ff6060", fontWeight: 700, fontFamily: "'Cinzel',serif",
                }}>
                <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={13} />
                {wrunex.toLocaleString()} wRX
              </button>
              <button
                onClick={() => { useGameStore.getState().setWallet(""); useGameStore.getState().setPlayer(null); }}
                style={{
                  fontSize: "0.6rem", padding: "3px 7px", borderRadius: 6,
                  border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)",
                  color: "#ef444488", cursor: "pointer",
                }}>
                ⏏ Exit
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Withdraw modal */}
      {showWithdraw && wallet && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-start", justifyContent: "center",
          paddingTop: 56,
        }} onClick={() => setShowWithdraw(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "linear-gradient(160deg,#1a0e00,#0d0700)",
            border: "1px solid rgba(255,96,96,0.35)", borderRadius: 14,
            padding: "18px 20px", width: 300, boxShadow: "0 8px 40px rgba(0,0,0,0.8)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={18} />
                <span style={{ fontFamily: "'Cinzel',serif", color: "#ff6060", fontWeight: 900, fontSize: "0.9rem" }}>Withdraw wRuneX</span>
              </div>
              <button onClick={() => setShowWithdraw(false)} style={{ color: "#6b4f10", background: "none", border: "none", cursor: "pointer", fontSize: "1rem" }}>✕</button>
            </div>
            <p style={{ color: "#7a6030", fontSize: "0.7rem", marginBottom: 10 }}>
              Swap in-game wRuneX → real RuneX sent to your Phantom wallet.<br />
              Balance: <span style={{ color: "#ff6060", fontWeight: 700 }}>{wrunex.toLocaleString()} wRuneX</span>
            </p>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <input
                type="number" min={100} max={wrunex}
                value={withdrawAmt}
                onChange={e => setWithdrawAmt(e.target.value)}
                placeholder="Amount (min 100)"
                style={{
                  flex: 1, borderRadius: 8, padding: "7px 10px", fontSize: "0.8rem", fontWeight: 700,
                  background: "rgba(0,0,0,0.4)", border: "1px solid #6b4f10", color: "#ffe8a0", outline: "none",
                }}
              />
              <button
                onClick={handleWithdraw}
                disabled={withdrawing || !withdrawAmt || parseFloat(withdrawAmt) < 100 || parseFloat(withdrawAmt) > wrunex}
                style={{
                  padding: "7px 14px", borderRadius: 8, fontWeight: 700, fontSize: "0.75rem", cursor: "pointer",
                  fontFamily: "'Cinzel',serif",
                  background: withdrawing || !withdrawAmt || parseFloat(withdrawAmt) < 100 || parseFloat(withdrawAmt) > wrunex
                    ? "rgba(107,114,128,0.15)" : "rgba(74,222,128,0.15)",
                  border: withdrawing || !withdrawAmt || parseFloat(withdrawAmt) < 100 || parseFloat(withdrawAmt) > wrunex
                    ? "1px solid #374151" : "1px solid rgba(74,222,128,0.4)",
                  color: withdrawing || !withdrawAmt || parseFloat(withdrawAmt) < 100 || parseFloat(withdrawAmt) > wrunex
                    ? "#6b7280" : "#4ade80",
                }}>
                {withdrawing ? "…" : "Swap →"}
              </button>
            </div>
            {withdrawMsg && (
              <p style={{ fontSize: "0.7rem", fontWeight: 700, color: withdrawMsg.ok ? "#4ade80" : "#ef4444", marginTop: 4 }}>
                {withdrawMsg.text}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      {wallet && (
        <nav className="flex overflow-x-auto"
             style={{ background: "#1a1200", borderBottom: "2px solid #6b4f10" }}>
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}
              style={({ isActive }) => ({
                padding: "8px 13px",
                fontFamily: "'Cinzel',serif",
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
                borderBottom: isActive ? "2px solid #ffcc00" : "2px solid transparent",
                color: isActive ? "#ffcc00" : "#a08040",
                background: isActive ? "rgba(255,204,0,0.06)" : "transparent",
                textDecoration: "none",
                transition: "all 0.1s",
              })}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      )}

      <main className="py-5">
        <Routes>
          <Route path="/"           element={<div className="max-w-lg mx-auto px-3"><Home /></div>} />
          <Route path="/shop"       element={<div className="max-w-lg mx-auto px-3"><Shop /></div>} />
          <Route path="/mint"       element={<div className="max-w-lg mx-auto px-3"><Mint /></div>} />
          <Route path="/characters" element={<div className="max-w-lg mx-auto px-3"><Characters /></div>} />
          <Route path="/dungeon"    element={<div className="max-w-lg mx-auto px-3"><Dungeon /></div>} />
          <Route path="/mining"     element={<div className="max-w-lg mx-auto px-3"><Mining /></div>} />
          <Route path="/heroes"     element={<div className="max-w-lg mx-auto px-3"><Heroes /></div>} />
          <Route path="/skills"     element={<div className="max-w-lg mx-auto px-3"><Skills /></div>} />
          <Route path="/inventory"  element={<Inventory />} />
          <Route path="/bank"       element={<div className="max-w-lg mx-auto px-3"><Bank /></div>} />
          <Route path="/wiki"       element={<div className="max-w-lg mx-auto px-3"><Wiki /></div>} />
          <Route path="/history"   element={<div className="max-w-lg mx-auto px-3"><History /></div>} />
          <Route path="/royale"    element={<div className="max-w-lg mx-auto px-3"><BattleRoyale /></div>} />
        </Routes>
      </main>
    </div>
  );
}
