import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store";
import { openBox, getPlayer } from "../api";
import type { Character } from "../api";
import { OsrsSprite, OsrsIcon } from "../components/OsrsSprite";
import { CHAR_SPRITES, ARMOR_ICONS, CHEST_SPRITES, RUNEX_ICON } from "../sprites";

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

// Helmet icons per class+rarity for the rarity grid
const RARITIES = ["common", "rare", "epic", "legendary"] as const;
const RARITY_LABELS = ["⬜ Common 60% 15d", "🔵 Rare 25% 20d", "🟣 Epic 12% 30d", "🟡 Legendary 3% 60d"];

function CharReveal({ char, onMintAgain, onView }: { char: Character; onMintAgain: () => void; onView: () => void }) {
  const s          = RARITY_STYLE[char.rarity];
  const rate       = TOKEN_RATES[char.class_type]?.[char.rarity] ?? 0;
  const spriteSrcs = CHAR_SPRITES[char.class_type]?.[char.rarity] ?? [];
  const armorSrc   = ARMOR_ICONS[char.class_type]?.[char.rarity]  ?? "";

  return (
    <div className="flex flex-col items-center gap-5 py-4 animate-fade-in">
      <p className="text-xl font-black" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00" }}>✨ Character obtained!</p>
      <div className="rounded-2xl overflow-hidden w-72"
           style={{ background: `linear-gradient(160deg,${s.bg.replace("0.08","0.2")} 0%,rgba(8,5,0,1) 100%)`, border: `2px solid ${s.border}`, boxShadow: `0 0 40px ${s.glow}` }}>

        {/* Rarity header with armor icon per rarity */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: s.border, background: s.bg }}>
          <div className="flex items-center gap-2">
            <OsrsIcon src={armorSrc} fallback={char.rarity_emoji} size={28} />
            <span className={`font-black text-sm tracking-widest uppercase osrs-label-${char.rarity}`}>{char.rarity}</span>
          </div>
          <span className="text-2xl">{char.rarity_emoji}</span>
        </div>

        {/* Character portrait */}
        <div className="flex flex-col items-center py-8 gap-3">
          <OsrsSprite srcs={spriteSrcs} fallback={char.emoji} size={80} />
          <p className="font-black text-white text-xl capitalize" style={{ fontFamily: "'Cinzel',serif" }}>{char.class_type}</p>
          <p className="text-sm text-center px-4" style={{ color: "#a08040" }}>{CLASS_DESC[char.class_type]}</p>
        </div>

        {/* Stats */}
        <div className="px-4 pb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span style={{ color: "#a08040" }}>Daily tokens</span>
            <span className="font-black" style={{ color: "#ffcc00" }}>{rate.toLocaleString()} gp</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "#a08040" }}>Expires in</span>
            <span className="font-black" style={{ color: "#ffe8a0" }}>{char.days_left} days</span>
          </div>
          {char.class_type !== "miner" && (
            <div className="flex justify-between text-sm">
              <span style={{ color: "#a08040" }}>Chest drop</span>
              <span className="font-black" style={{ color: "#6dde6d" }}>0.003%/min</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onView} className="osrs-btn px-6">View Characters</button>
        <button onClick={onMintAgain} className="osrs-btn-green px-6">Mint Again</button>
      </div>
    </div>
  );
}

type Phase = "idle" | "shaking" | "open" | "revealed";

export default function Mint() {
  const { wallet, player, setPlayer } = useGameStore();
  const [phase, setPhase]   = useState<Phase>("idle");
  const [error, setError]   = useState("");
  const [result, setResult] = useState<Character | null>(null);
  const pendingResult       = useRef<Character | null>(null);
  const nav = useNavigate();

  const BOX_COST  = 50_000;   // RuneX
  const canAfford = (player?.runex ?? 0) >= BOX_COST;

  async function handleMint() {
    if (!wallet || !canAfford || phase !== "idle") return;
    setError("");
    setPhase("shaking");

    // fire API immediately; animation plays in parallel
    openBox(wallet)
      .then(res => getPlayer(wallet).then(updated => { setPlayer(updated); return res; }))
      .then(res => { pendingResult.current = res.character; })
      .catch(e => {
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail ?? "Failed to open box");
        setPhase("idle");
      });

    // animation timing
    setTimeout(() => setPhase("open"), 700);
    setTimeout(() => {
      const char = pendingResult.current;
      if (char) { setResult(char); setPhase("revealed"); }
      else {
        // wait a bit more for the API
        const poll = setInterval(() => {
          if (pendingResult.current) {
            setResult(pendingResult.current);
            setPhase("revealed");
            clearInterval(poll);
          }
        }, 100);
      }
    }, 1500);
  }

  if (!wallet) return (
    <div className="text-center py-20">
      <button onClick={() => nav("/")} className="osrs-btn-green px-6 py-3">Connect wallet first</button>
    </div>
  );

  if (phase === "revealed" && result) return (
    <CharReveal char={result} onMintAgain={() => { setResult(null); pendingResult.current = null; setPhase("idle"); }} onView={() => nav("/characters")} />
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <OsrsSprite srcs={CHEST_SPRITES.closed} fallback="📦" size={32} pixelated={false} />
        <h1 className="text-2xl font-black" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00" }}>Mint Box</h1>
      </div>

      <div className="osrs-panel p-6">
        <div className="flex flex-col items-center gap-4 py-4">

          {/* Chest sprite with animation */}
          <div className={`relative flex items-center justify-center ${phase === "shaking" ? "animate-chest-shake" : ""}`}
               style={{
                 width: 160, height: 160,
                 background: "radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 70%)",
                 filter: phase === "open" ? "drop-shadow(0 0 40px rgba(251,191,36,0.9))" : "drop-shadow(0 0 16px rgba(251,191,36,0.4))",
               }}>
            <OsrsSprite
              srcs={phase === "open" ? CHEST_SPRITES.open : CHEST_SPRITES.closed}
              fallback={phase === "open" ? "📭" : "📦"}
              size={144}
              pixelated={false}
            />
            {phase === "open" && (
              <>
                <div className="absolute inset-0 rounded-full animate-ping"
                     style={{ background: "rgba(251,191,36,0.15)", animationDuration: "0.5s", animationIterationCount: 3 }} />
                <div className="absolute -top-4 text-3xl animate-bounce">✨</div>
              </>
            )}
          </div>

          <p className="font-black text-lg" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00" }}>
            {phase === "shaking" ? "Opening…" : phase === "open" ? "What's inside?!" : "Treasure Chest"}
          </p>

          {phase === "idle" && (
            <p className="text-sm text-center" style={{ color: "#a08040" }}>
              Contains 1 random character — Archer, Warrior, Mage, or Miner.<br />
              Rarity determines lifespan and token generation.
            </p>
          )}

          {/* Rarity grid — shown when idle */}
          {phase === "idle" && (
            <div className="grid grid-cols-4 gap-2 w-full text-center text-xs mt-2">
              {RARITIES.map((r, i) => (
                <div key={r} className="rounded-lg p-2 space-y-1" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #6b4f10" }}>
                  <OsrsIcon src={ARMOR_ICONS["warrior"][r]} fallback="" size={24} />
                  <p className={`font-bold osrs-label-${r} capitalize`}>{r}</p>
                  <p style={{ color: "#a08040" }}>{RARITY_LABELS[i].split(" ")[1]}</p>
                  <p style={{ color: "#ffe8a0" }}>{RARITY_LABELS[i].split(" ")[2]}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

        {phase === "idle" && (
          <>
            <div className="flex items-center justify-center gap-2 mb-2">
              <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={18} />
              <span style={{ color: canAfford ? "#ff6060" : "#6b7280", fontWeight: 700, fontFamily: "'Cinzel',serif" }}>
                {(player?.runex ?? 0).toLocaleString()} / {BOX_COST.toLocaleString()} RuneX
              </span>
            </div>
            {canAfford && (
              <button
                onClick={handleMint}
                className="osrs-btn-green w-full py-3 text-base">
                🎁 Open Chest · 50,000 RuneX
              </button>
            )}
          </>
        )}

        {(phase === "shaking" || phase === "open") && (
          <div className="flex justify-center">
            <span className="text-2xl animate-spin" style={{ animationDuration: "1s" }}>✨</span>
          </div>
        )}
      </div>

      {/* Classes preview — equipment icons only (no chathead) */}
      {phase === "idle" && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "'Cinzel',serif", color: "#a08040" }}>Classes</p>
          {(["archer","warrior","mage","miner"] as const).map(cls => (
            <div key={cls} className="flex items-center gap-3 rounded-xl px-4 py-3"
                 style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #6b4f10" }}>
              {/* Show all 4 rarity equipment icons */}
              <div className="flex gap-1">
                {RARITIES.map(r => (
                  <OsrsIcon key={r} src={ARMOR_ICONS[cls][r]} fallback="" size={22} />
                ))}
              </div>
              <div className="flex-1">
                <p className="font-black text-sm capitalize" style={{ fontFamily: "'Cinzel',serif", color: "#ffe8a0" }}>{cls}</p>
                <p className="text-xs" style={{ color: "#a08040" }}>
                  {cls === "miner" ? "12k–30k gp/day · no chests · no items" : "10k–20k gp/day · drops chests · equips items"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
