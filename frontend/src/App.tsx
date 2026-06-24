import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { useGameStore } from "./store";
import Home from "./pages/Home";
import Characters from "./pages/Characters";
import Mint from "./pages/Mint";
import Inventory from "./pages/Inventory";

const NAV = [
  { to: "/",           label: "🏠 Home" },
  { to: "/mint",       label: "📦 Mint" },
  { to: "/characters", label: "⚔️ Characters" },
  { to: "/inventory",  label: "🎒 Inventory" },
];

export default function App() {
  const { wallet, player } = useGameStore();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <span className="font-black text-lg text-yellow-400">⚔️ RPGame</span>
        {wallet && (
          <div className="flex items-center gap-3">
            <span className="text-yellow-400 font-black text-sm">
              {(player?.tokens ?? 0).toLocaleString()} tokens
            </span>
            <span className="text-gray-500 text-xs">
              {wallet.slice(0, 4)}…{wallet.slice(-4)}
            </span>
          </div>
        )}
      </header>

      {/* Nav */}
      {wallet && (
        <nav className="flex gap-1 px-3 py-2 bg-gray-900 border-b border-gray-800 overflow-x-auto">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                  isActive ? "bg-yellow-500 text-gray-900" : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`
              }>
              {n.label}
            </NavLink>
          ))}
        </nav>
      )}

      <main className="max-w-lg mx-auto px-4 py-6">
        <Routes>
          <Route path="/"           element={<Home />} />
          <Route path="/mint"       element={<Mint />} />
          <Route path="/characters" element={<Characters />} />
          <Route path="/inventory"  element={<Inventory />} />
        </Routes>
      </main>
    </div>
  );
}
