import { useState } from "react";
import { useGameStore } from "../store";
import { buyRunexChest, buyItemChest, getPlayer } from "../api";
import type { CharacterItem } from "../api";
import { OsrsSprite } from "../components/OsrsSprite";
import { CHEST_SPRITES, ITEM_CHEST_SPRITES, RUNEX_ICON, GAME_ICONS } from "../sprites";

const CHEST_COST      = 5_000;
const ITEM_CHEST_COST = 8_000;

const RARITY_COLOR: Record<string, string> = {
  common:    "#a0a0a0",
  rare:      "#4a90ff",
  epic:      "#a855f7",
  legendary: "#ffcc00",
};

type Phase = "idle" | "opening" | "done";

function ChestCard({
  title,
  cost,
  rangeLabel,
  sprites,
  gold,
  phase,
  onBuy,
  onReset,
  error,
  children,
}: {
  title: string;
  cost: number;
  rangeLabel: string;
  sprites: typeof CHEST_SPRITES;
  gold: number;
  phase: Phase;
  onBuy: () => void;
  onReset: () => void;
  error: string;
  children?: React.ReactNode;
}) {
  const canAfford = gold >= cost;

  return (
    <div className="rounded-2xl overflow-hidden"
         style={{ background: "linear-gradient(160deg,rgba(255,100,0,0.07) 0%,rgba(8,5,0,1) 100%)", border: "1.5px solid rgba(251,191,36,0.3)" }}>

      {/* Range badge */}
      <div className="flex justify-center pt-5">
        <div className="flex items-center gap-2 rounded-full px-4 py-1"
             style={{ background: "rgba(255,160,0,0.12)", border: "1px solid rgba(251,191,36,0.25)" }}>
          <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={14} />
          <span style={{ fontFamily: "'Cinzel',serif", color: "#ffaa30", fontWeight: 700, fontSize: "0.82rem" }}>
            {rangeLabel}
          </span>
        </div>
      </div>

      {/* Chest sprite */}
      <div className="flex flex-col items-center pt-4 pb-2 gap-3">
        <div style={{ filter: phase === "done" ? "drop-shadow(0 0 28px rgba(255,140,0,0.7))" : "drop-shadow(0 0 10px rgba(251,191,36,0.35))" }}>
          <OsrsSprite
            srcs={phase === "done" ? sprites.open : sprites.closed}
            fallback={phase === "done" ? "📭" : "📦"}
            size={96}
            pixelated={false}
          />
        </div>

        <p className="font-black text-base" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00" }}>
          {title}
        </p>
        <p className="text-xs text-center px-8" style={{ color: "#7a6030" }}>
          Opens the chest and awards a random amount of RuneX.
        </p>

        {/* Opening spinner */}
        {phase === "opening" && (
          <div className="flex items-center gap-2 py-1">
            <span className="text-lg animate-spin" style={{ animationDuration: "0.7s" }}>✨</span>
            <span style={{ color: "#a08040", fontSize: "0.82rem" }}>Opening…</span>
          </div>
        )}

        {/* Result */}
        {phase === "done" && children}
      </div>

      {/* Action */}
      <div className="px-5 pb-5 pt-1 space-y-2">
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        {phase === "done" ? (
          <button onClick={onReset} className="osrs-btn-green w-full py-3 text-sm">
            Open Another
          </button>
        ) : (
          <button
            onClick={onBuy}
            disabled={!canAfford || phase !== "idle"}
            className={canAfford && phase === "idle" ? "osrs-btn-green w-full py-3 text-sm" : "w-full py-3 rounded-xl font-black text-sm"}
            style={!(canAfford && phase === "idle") ? { background: "rgba(107,114,128,0.15)", border: "1px solid rgba(107,114,128,0.25)", color: "#6b7280", cursor: "not-allowed" } : {}}>
            {phase === "opening"
              ? "Opening…"
              : canAfford
              ? `Open · ${cost.toLocaleString()} Gold`
              : `Need ${cost.toLocaleString()} Gold (you have ${gold.toLocaleString()})`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Shop() {
  const { wallet, player, setPlayer } = useGameStore();

  const gold  = player?.tokens ?? 0;
  const runex = player?.runex  ?? 0;

  // RuneX chest state
  const [phase1,   setPhase1]   = useState<Phase>("idle");
  const [result1,  setResult1]  = useState<number | null>(null);
  const [error1,   setError1]   = useState("");

  // Item chest state
  const [phase2,   setPhase2]   = useState<Phase>("idle");
  const [runex2,   setRunex2]   = useState<number | null>(null);
  const [item2,    setItem2]    = useState<CharacterItem | null>(null);
  const [error2,   setError2]   = useState("");

  async function refreshPlayer() {
    if (!wallet) return;
    const p = await getPlayer(wallet);
    setPlayer(p);
  }

  async function handleRunexChest() {
    if (!wallet || gold < CHEST_COST || phase1 !== "idle") return;
    setError1("");
    setPhase1("opening");
    try {
      const res = await buyRunexChest(wallet);
      await refreshPlayer();
      setResult1(res.runex_gained);
      setPhase1("done");
    } catch (e: unknown) {
      const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError1(d ?? "Error opening chest");
      setPhase1("idle");
    }
  }

  async function handleItemChest() {
    if (!wallet || gold < ITEM_CHEST_COST || phase2 !== "idle") return;
    setError2("");
    setPhase2("opening");
    try {
      const res = await buyItemChest(wallet);
      await refreshPlayer();
      setRunex2(res.runex_gained);
      setItem2(res.item_dropped);
      setPhase2("done");
    } catch (e: unknown) {
      const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError2(d ?? "Error opening chest");
      setPhase2("idle");
    }
  }

  if (!wallet) return (
    <p className="text-center text-gray-500 py-20">Connect your wallet first.</p>
  );

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-2">
        <OsrsSprite srcs={CHEST_SPRITES.closed} fallback="🏪" size={28} pixelated={false} />
        <h1 className="text-xl font-black" style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00" }}>Shop</h1>
      </div>

      {/* Wallet */}
      <div className="rounded-xl px-4 py-2.5 flex items-center justify-between"
           style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #6b4f10" }}>
        <div className="flex items-center gap-2">
          <OsrsSprite srcs={GAME_ICONS.gold} fallback="🪙" size={16} pixelated={false} />
          <span style={{ color: "#ffcc00", fontWeight: 700, fontFamily: "'Cinzel',serif", fontSize: "0.82rem" }}>
            {gold.toLocaleString()} Gold
          </span>
        </div>
        <div className="flex items-center gap-2">
          <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={14} />
          <span style={{ color: "#ff6060", fontWeight: 700, fontFamily: "'Cinzel',serif", fontSize: "0.82rem" }}>
            {runex.toLocaleString()} RuneX
          </span>
        </div>
      </div>

      {/* RuneX Chest */}
      <ChestCard
        title="RuneX Chest"
        cost={CHEST_COST}
        rangeLabel="1,500 ~ 10,000 RuneX"
        sprites={CHEST_SPRITES}
        gold={gold}
        phase={phase1}
        onBuy={handleRunexChest}
        onReset={() => { setPhase1("idle"); setResult1(null); }}
        error={error1}
      >
        {phase1 === "done" && result1 !== null && (
          <div className="rounded-xl px-5 py-3 text-center"
               style={{ background: "rgba(255,100,0,0.08)", border: "1px solid rgba(251,191,36,0.3)" }}>
            <p className="text-xs mb-1" style={{ color: "#7a6030" }}>You received</p>
            <div className="flex items-center justify-center gap-2">
              <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={24} />
              <span style={{ fontFamily: "'Cinzel',serif", color: "#ff6060", fontSize: "1.8rem", fontWeight: 900 }}>
                +{result1.toLocaleString()}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "#7a6030" }}>RuneX</p>
          </div>
        )}
      </ChestCard>

      {/* Item Chest */}
      <ChestCard
        title="Item Chest"
        cost={ITEM_CHEST_COST}
        rangeLabel="2,500 ~ 5,000 RuneX"
        sprites={ITEM_CHEST_SPRITES}
        gold={gold}
        phase={phase2}
        onBuy={handleItemChest}
        onReset={() => { setPhase2("idle"); setRunex2(null); setItem2(null); }}
        error={error2}
      >
        {phase2 === "done" && runex2 !== null && (
          <div className="rounded-xl px-5 py-3 text-center w-full"
               style={{ background: "rgba(255,100,0,0.08)", border: "1px solid rgba(251,191,36,0.3)" }}>
            <p className="text-xs mb-1" style={{ color: "#7a6030" }}>You received</p>
            <div className="flex items-center justify-center gap-2 mb-2">
              <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={20} />
              <span style={{ fontFamily: "'Cinzel',serif", color: "#ff6060", fontSize: "1.4rem", fontWeight: 900 }}>
                +{runex2.toLocaleString()} RuneX
              </span>
            </div>
            {item2 ? (
              <div className="rounded-lg px-3 py-2 mt-1"
                   style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${RARITY_COLOR[item2.item_rarity ?? "common"]}50` }}>
                <p className="text-xs font-bold mb-0.5" style={{ color: RARITY_COLOR[item2.item_rarity ?? "common"], textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Item dropped!
                </p>
                <p className="font-black text-sm" style={{ fontFamily: "'Cinzel',serif", color: RARITY_COLOR[item2.item_rarity ?? "common"] }}>
                  {item2.item_name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#7a6030" }}>
                  {item2.item_rarity} · {item2.item_slot}
                </p>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "#4a3820" }}>No item this time.</p>
            )}
          </div>
        )}
      </ChestCard>

      {/* Info */}
      <div className="rounded-xl px-4 py-3 space-y-1.5"
           style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(107,79,16,0.25)" }}>
        <p className="text-xs font-bold" style={{ color: "#7a6030", fontFamily: "'Cinzel',serif" }}>How to earn RuneX</p>
        <div className="space-y-1 text-xs" style={{ color: "#4a3820" }}>
          <p>⚔ HeroX battles — complete phases to earn RuneX</p>
          <p>🎁 Buy chests in the shop with Gold</p>
          <p>💎 Spend RuneX in Mint to unlock staker characters (50k RuneX)</p>
        </div>
      </div>

    </div>
  );
}
