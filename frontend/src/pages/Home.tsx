import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store";
import { loginPlayer, getPlayer } from "../api";

export default function Home() {
  const { wallet, player, setWallet, setPlayer } = useGameStore();
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const nav = useNavigate();

  async function handleLogin() {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      await loginPlayer(input.trim());
      const p = await getPlayer(input.trim());
      setWallet(input.trim());
      setPlayer(p);
      nav("/characters");
    } catch {
      setError("Failed to connect. Check the wallet address.");
    } finally {
      setLoading(false);
    }
  }

  if (wallet && player) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="rounded-2xl p-6 text-center"
             style={{ background: "linear-gradient(135deg,#1a0a40,#0c0020)", border: "1px solid rgba(168,85,247,0.3)" }}>
          <p className="text-4xl mb-3">⚔️</p>
          <h1 className="text-2xl font-black text-white">Welcome back!</h1>
          <p className="text-gray-400 text-sm mt-1">{wallet.slice(0, 8)}…{wallet.slice(-8)}</p>
          <p className="text-yellow-400 font-black text-xl mt-3">{player.tokens.toLocaleString()} tokens</p>
          <p className="text-gray-500 text-sm">{player.character_count} character{player.character_count !== 1 ? "s" : ""}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { to: "/mint",       emoji: "📦", label: "Mint Box",    desc: "Get new characters" },
            { to: "/characters", emoji: "⚔️",  label: "Characters",  desc: "Stake & manage" },
            { to: "/inventory",  emoji: "🎒", label: "Inventory",   desc: "Use your items" },
          ].map(c => (
            <button key={c.to} onClick={() => nav(c.to)}
              className="rounded-xl p-4 text-left transition-all hover:-translate-y-0.5"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-2xl mb-1">{c.emoji}</p>
              <p className="font-black text-white text-sm">{c.label}</p>
              <p className="text-gray-500 text-xs">{c.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
      <div className="text-center">
        <p className="text-6xl mb-4">⚔️</p>
        <h1 className="text-3xl font-black text-white">RPGame</h1>
        <p className="text-gray-400 mt-2">Mint characters. Stake them. Earn tokens.</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <input
          className="w-full rounded-xl px-4 py-3 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
          placeholder="Enter your wallet address"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
        />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button
          onClick={handleLogin}
          disabled={loading || !input.trim()}
          className="w-full py-3 rounded-xl font-black text-gray-900 transition-all"
          style={{ background: loading ? "#6b7280" : "#eab308", cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Connecting…" : "▶ Enter Game"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-sm text-center text-xs text-gray-500">
        {[["🏹", "Archer"], ["⚔️", "Warrior"], ["🔮", "Mage"], ["⛏️", "Miner"], ["💚", "Vitality"], ["⚡", "Token Boost"]].map(([e, l]) => (
          <div key={l} className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-xl">{e}</p><p>{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
