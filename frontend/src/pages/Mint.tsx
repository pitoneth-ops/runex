import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store";
import { openBox, getPlayer } from "../api";
import type { Character } from "../api";

const RARITY_STYLE: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  common:    { color: "#9ca3af", bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.25)", glow: "rgba(156,163,175,0.15)" },
  rare:      { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.3)",   glow: "rgba(96,165,250,0.2)"  },
  epic:      { color: "#c084fc", bg: "rgba(192,132,252,0.08)", border: "rgba(192,132,252,0.3)",  glow: "rgba(192,132,252,0.25)"},
  legendary: { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.35)",  glow: "rgba(251,191,36,0.35)" },
};

const CLASS_DESC: Record<string, string> = {
  archer:  "Trains at the range — generates tokens and can drop item chests.",
  warrior: "Battles monsters at the front — generates tokens and can drop item chests.",
  mage:    "Studies arcane arts — generates tokens and can drop item chests.",
  miner:   "Works the mines — no items, but earns the most tokens.",
};

const TOKEN_RATES: Record<string, Record<string, number>> = {
  archer:  { common: 10000, rare: 12500, epic: 15000, legendary: 20000 },
  warrior: { common: 10000, rare: 12500, epic: 15000, legendary: 20000 },
  mage:    { common: 10000, rare: 12500, epic: 15000, legendary: 20000 },
  miner:   { common: 12000, rare: 17000, epic: 23000, legendary: 30000 },
};

function CharReveal({ char, onMintAgain, onView }: { char: Character; onMintAgain: () => void; onView: () => void }) {
  const s = RARITY_STYLE[char.rarity];
  const rate = TOKEN_RATES[char.class_type]?.[char.rarity] ?? 0;

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <p className="text-xl font-black" style={{ color: s.color }}>✨ Character obtained!</p>
      <div className="rounded-2xl overflow-hidden w-72"
           style={{ background: `linear-gradient(160deg,${s.bg.replace("0.08","0.2")} 0%,rgba(5,8,20,1) 100%)`, border: `2px solid ${s.border}`, boxShadow: `0 0 40px ${s.glow}` }}>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: s.border, background: s.bg }}>
          <span className="font-black text-xs tracking-widest uppercase" style={{ color: s.color }}>{char.rarity}</span>
          <span className="text-2xl">{char.rarity_emoji}</span>
        </div>
        <div className="flex flex-col items-center py-8 gap-2">
          <span className="text-7xl">{char.emoji}</span>
          <p className="font-black text-white text-xl capitalize">{char.class_type}</p>
          <p className="text-gray-400 text-sm text-center px-4">{CLASS_DESC[char.class_type]}</p>
        </div>
        <div className="px-4 pb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Daily tokens</span>
            <span className="font-black" style={{ color: s.color }}>{rate.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Expires in</span>
            <span className="font-black text-white">{char.days_left} days</span>
          </div>
          {char.class_type !== "miner" && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Chest drop</span>
              <span className="font-black text-green-400">0.003%/min</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onView}
          className="px-6 py-2.5 rounded-xl font-black text-sm"
          style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
          View Characters
        </button>
        <button onClick={onMintAgain}
          className="px-6 py-2.5 rounded-xl font-black text-sm text-gray-900"
          style={{ background: "#eab308" }}>
          Mint Again
        </button>
      </div>
    </div>
  );
}

export default function Mint() {
  const { wallet, player, setPlayer } = useGameStore();
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState("");
  const [result, setResult]    = useState<Character | null>(null);
  const nav = useNavigate();

  const BOX_COST = 50_000;
  const canAfford = (player?.tokens ?? 0) >= BOX_COST;

  async function handleMint() {
    if (!wallet || !canAfford) return;
    setLoading(true);
    setError("");
    try {
      const res = await openBox(wallet);
      const updated = await getPlayer(wallet);
      setPlayer(updated);
      setResult(res.character);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to open box");
    } finally {
      setLoading(false);
    }
  }

  if (!wallet) return (
    <div className="text-center py-20">
      <button onClick={() => nav("/")} className="px-6 py-3 rounded-xl bg-yellow-500 text-gray-900 font-black">
        Connect wallet first
      </button>
    </div>
  );

  if (result) return (
    <CharReveal char={result} onMintAgain={() => setResult(null)} onView={() => nav("/characters")} />
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-black text-yellow-400">📦 Mint Box</h1>

      <div className="rounded-2xl p-6"
           style={{ background: "linear-gradient(135deg,rgba(251,191,36,0.08),rgba(5,8,20,1))", border: "2px solid rgba(251,191,36,0.3)" }}>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="text-8xl" style={{ filter: "drop-shadow(0 0 30px rgba(251,191,36,0.4))" }}>📦</div>
          <p className="font-black text-white text-lg">Mystery Box</p>
          <p className="text-gray-400 text-sm text-center">
            Contains 1 random character — Archer, Warrior, Mage, or Miner.<br />
            Rarity determines lifespan and token generation.
          </p>
          <div className="grid grid-cols-4 gap-2 w-full text-center text-xs mt-2">
            {[["⬜","Common","60%","15d"],["🔵","Rare","25%","20d"],["🟣","Epic","12%","30d"],["🟡","Legendary","3%","60d"]].map(([e,l,p,d]) => (
              <div key={l} className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-base">{e}</p>
                <p className="font-bold text-white">{l}</p>
                <p className="text-gray-500">{p}</p>
                <p className="text-gray-400">{d}</p>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

        <button
          onClick={handleMint}
          disabled={loading || !canAfford}
          className="w-full py-3 rounded-xl font-black text-lg transition-all"
          style={{
            background: canAfford && !loading ? "#eab308" : "rgba(107,114,128,0.3)",
            color: canAfford && !loading ? "#1f2937" : "#6b7280",
            cursor: canAfford && !loading ? "pointer" : "not-allowed",
          }}>
          {loading ? "Opening…" : canAfford ? `Open Box · 50,000 tokens` : `Need 50,000 tokens (you have ${(player?.tokens ?? 0).toLocaleString()})`}
        </button>
      </div>

      {/* Classes preview */}
      <div className="space-y-2">
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Classes</p>
        {[
          { emoji: "🏹", name: "Archer",  tokens: "10k–20k/day", chest: true,  items: true  },
          { emoji: "⚔️",  name: "Warrior", tokens: "10k–20k/day", chest: true,  items: true  },
          { emoji: "🔮", name: "Mage",    tokens: "10k–20k/day", chest: true,  items: true  },
          { emoji: "⛏️", name: "Miner",   tokens: "12k–30k/day", chest: false, items: false },
        ].map(c => (
          <div key={c.name} className="flex items-center gap-3 rounded-xl px-4 py-3"
               style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-2xl">{c.emoji}</span>
            <div className="flex-1">
              <p className="font-black text-white text-sm">{c.name}</p>
              <p className="text-gray-500 text-xs">{c.tokens} · {c.chest ? "drops chests" : "no chests"} · {c.items ? "equips items" : "no item slots"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
