import { Routes, Route, NavLink } from "react-router-dom";
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
  const { wallet, player } = useGameStore();

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
          <div className="flex items-center gap-3">
            {/* Gold */}
            <div className="flex items-center gap-1">
              <OsrsIcon src={GAME_ICONS.gold[0]} fallback="🪙" size={16} />
              <span style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontWeight: 700, fontSize: "0.8rem" }}>
                {(player?.tokens ?? 0).toLocaleString()}
              </span>
            </div>
            {/* wRuneX in-game */}
            {(player?.wrunex ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={14} />
                <span style={{ fontFamily: "'Cinzel',serif", color: "#ff6060", fontWeight: 700, fontSize: "0.8rem" }}>
                  {(player?.wrunex ?? 0).toLocaleString()} <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>wRX</span>
                </span>
              </div>
            )}
            <span style={{ color: "#a08040", fontSize: "0.7rem" }}>
              {wallet.slice(0, 4)}…{wallet.slice(-4)}
            </span>
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
        )}
      </header>

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
