import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store";
import { authWallet } from "../api";
import { OsrsSprite } from "../components/OsrsSprite";
import { CHAR_SPRITES, GAME_ICONS, CHEST_SPRITES, RUNEX_ICON } from "../sprites";

// ── Solana provider types ──────────────────────────────────────────────────────
interface SolanaPublicKey {
  toString: () => string;
  toBytes:  () => Uint8Array;
}
interface PhantomProvider {
  isPhantom?:  boolean;
  isConnected: boolean;
  publicKey?:  SolanaPublicKey;
  connect:     () => Promise<{ publicKey: SolanaPublicKey }>;
  disconnect:  () => Promise<void>;
  signMessage: (msg: Uint8Array, enc: string) => Promise<{ signature: Uint8Array }>;
}
interface SolflareProvider {
  isSolflare?: boolean;
  isConnected: boolean;
  publicKey?:  SolanaPublicKey;
  connect:     () => Promise<void>;
  disconnect:  () => Promise<void>;
  signMessage: (msg: Uint8Array) => Promise<{ signature: Uint8Array }>;
}
declare global {
  interface Window {
    solana?:   PhantomProvider;
    solflare?: SolflareProvider;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function buildAuthMessage(pubkey: string): string {
  return `RuneX Game Auth\nWallet: ${pubkey}\nTimestamp: ${Date.now()}`;
}

// ── Quick-connect card ─────────────────────────────────────────────────────────
function WalletButton({
  name, logo, available, loading, onClick,
}: {
  name: string; logo: string; available: boolean; loading: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || !available}
      style={{
        width: "100%", padding: "14px 18px",
        borderRadius: 14, cursor: available && !loading ? "pointer" : "not-allowed",
        background: available
          ? loading ? "rgba(40,20,0,0.6)" : "linear-gradient(135deg,rgba(255,204,0,0.08),rgba(0,0,0,0.5))"
          : "rgba(0,0,0,0.25)",
        border: `1.5px solid ${available ? "#6b4f10" : "#2a1a00"}`,
        display: "flex", alignItems: "center", gap: 14,
        transition: "all 0.15s",
        boxShadow: available && !loading ? "0 0 18px rgba(255,204,0,0.06)" : "none",
      }}>
      <span style={{ fontSize: "1.6rem", flexShrink: 0 }}>{logo}</span>
      <div style={{ flex: 1, textAlign: "left" }}>
        <p style={{
          fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: "0.9rem",
          color: available ? "#ffe8a0" : "#3d2a00",
        }}>
          {loading ? "Connecting…" : available ? `Connect ${name}` : `${name} not detected`}
        </p>
        <p style={{ fontSize: "0.62rem", color: available ? "#6b4f10" : "#2a1a00", marginTop: 2 }}>
          {available ? "Sign a message to verify ownership" : `Install the ${name} extension`}
        </p>
      </div>
      {available && !loading && (
        <span style={{ color: "#6b4f10", fontSize: "1rem" }}>→</span>
      )}
      {loading && (
        <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #ffcc00", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
      )}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Home() {
  const { wallet, player, setWallet, setPlayer } = useGameStore();
  const [loading, setLoading]       = useState<"phantom" | "solflare" | null>(null);
  const [error, setError]           = useState("");
  const [hasPhantom, setHasPhantom] = useState(false);
  const [hasSolflare, setHasSolflare] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    const detect = () => {
      setHasPhantom(!!(window.solana?.isPhantom));
      setHasSolflare(!!(window.solflare?.isSolflare));
    };
    detect();
    // Wallet extensions inject after page load
    const t = setTimeout(detect, 800);
    return () => clearTimeout(t);
  }, []);

  async function connect(type: "phantom" | "solflare") {
    setLoading(type);
    setError("");
    try {
      let pubkey: string;
      let sigBytes: Uint8Array;
      const message = buildAuthMessage("PLACEHOLDER");

      if (type === "phantom") {
        const prov = window.solana!;
        const res  = await prov.connect();
        pubkey     = res.publicKey.toString();
        const finalMsg = buildAuthMessage(pubkey);
        const signed = await prov.signMessage(new TextEncoder().encode(finalMsg), "utf8");
        sigBytes = signed.signature;

        const p = await authWallet(pubkey, toHex(sigBytes), finalMsg);
        setWallet(pubkey);
        setPlayer(p);
      } else {
        const prov = window.solflare!;
        await prov.connect();
        pubkey = prov.publicKey!.toString();
        const finalMsg = buildAuthMessage(pubkey);
        const signed = await prov.signMessage(new TextEncoder().encode(finalMsg));
        sigBytes = signed.signature;

        const p = await authWallet(pubkey, toHex(sigBytes), finalMsg);
        setWallet(pubkey);
        setPlayer(p);
      }

      nav("/characters");
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "";
      if (msg.includes("rejected") || msg.includes("cancelled") || msg.includes("cancel")) {
        setError("Connection cancelled.");
      } else if (msg.includes("Signature")) {
        setError("Signature verification failed. Try again.");
      } else if (msg) {
        setError(msg);
      } else {
        setError("Could not connect. Make sure your wallet is unlocked.");
      }
    } finally {
      setLoading(null);
    }
  }

  // ── Logged-in dashboard ────────────────────────────────────────────────────
  if (wallet && player) {
    return (
      <div className="space-y-5 animate-fade-in">

        {/* Welcome card */}
        <div style={{
          borderRadius: 16, padding: "20px 18px",
          background: "linear-gradient(160deg,rgba(255,204,0,0.06),rgba(5,2,0,0.95))",
          border: "1px solid rgba(255,204,0,0.2)",
          textAlign: "center",
        }}>
          <OsrsSprite srcs={GAME_ICONS.sword} fallback="⚔" size={44} pixelated={false} />
          <h1 style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "1.3rem", fontWeight: 900, marginTop: 10 }}>
            Welcome back!
          </h1>
          <p style={{ color: "#6b4f10", fontSize: "0.65rem", marginTop: 4, fontFamily: "monospace" }}>
            {wallet.slice(0, 6)}…{wallet.slice(-6)}
          </p>

          {/* Balances */}
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 14 }}>
            <div>
              <p style={{ color: "#6b4f10", fontSize: "0.6rem" }}>GOLD</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                <OsrsSprite srcs={GAME_ICONS.gold} fallback="🪙" size={14} />
                <p style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "1.1rem", fontWeight: 900 }}>
                  {player.tokens.toLocaleString()}
                </p>
              </div>
            </div>
            <div style={{ width: 1, background: "#2a1a00" }} />
            <div>
              <p style={{ color: "#6b4f10", fontSize: "0.6rem" }}>RUNEX</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={14} />
                <p style={{ fontFamily: "'Cinzel',serif", color: "#ffaa30", fontSize: "1.1rem", fontWeight: 900 }}>
                  {(player.runex ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div style={{ width: 1, background: "#2a1a00" }} />
            <div>
              <p style={{ color: "#6b4f10", fontSize: "0.6rem" }}>wRUNEX</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                <OsrsSprite srcs={RUNEX_ICON} fallback="💎" size={14} />
                <p style={{ fontFamily: "'Cinzel',serif", color: "#ff6060", fontSize: "1.1rem", fontWeight: 900 }}>
                  {(player.wrunex ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <p style={{ color: "#a08040", fontSize: "0.7rem", marginTop: 10 }}>
            {player.character_count} character{player.character_count !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Quick-action grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { to: "/mint",      srcs: CHEST_SPRITES.closed,  fallback: "📦", label: "Mint Box",   desc: "Get new characters" },
            { to: "/dungeon",   srcs: GAME_ICONS.dungeon,     fallback: "⚔",  label: "Dungeon",    desc: "Send fighters to battle" },
            { to: "/mining",    srcs: GAME_ICONS.mining,      fallback: "⛏",  label: "Mining",     desc: "Put miners to work" },
            { to: "/heroes",    srcs: GAME_ICONS.sword,       fallback: "⚔",  label: "Heroes",     desc: "Daily HeroX battles" },
            { to: "/royale",    srcs: GAME_ICONS.dungeon,     fallback: "👑",  label: "Royale",     desc: "7-fight gauntlet" },
            { to: "/inventory", srcs: GAME_ICONS.backpack,    fallback: "🎒",  label: "Inventory",  desc: "Manage your items" },
          ].map(c => (
            <button key={c.to} onClick={() => nav(c.to)}
              className="osrs-panel rounded-xl p-4 text-left transition-all hover:brightness-110">
              <div className="mb-2">
                <OsrsSprite srcs={c.srcs} fallback={c.fallback} size={32} pixelated={false} />
              </div>
              <p style={{ fontFamily: "'Cinzel',serif", color: "#ffe8a0", fontSize: "0.8rem", fontWeight: 700 }}>{c.label}</p>
              <p style={{ color: "#a08040", fontSize: "0.62rem" }}>{c.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Connect screen ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 animate-fade-in">

      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <OsrsSprite srcs={GAME_ICONS.sword} fallback="⚔" size={72} pixelated={false} />
        </div>
        <h1 style={{ fontFamily: "'Cinzel',serif", color: "#ffcc00", fontSize: "2rem", fontWeight: 900, letterSpacing: "0.05em" }}>
          RuneX
        </h1>
        <p style={{ color: "#a08040", marginTop: 6, fontSize: "0.8rem" }}>
          Mint characters. Stake them. Earn on-chain RuneX.
        </p>
      </div>

      {/* Currency split */}
      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 360 }}>
        {[
          { icon: "🪙", label: "Gold",  desc: "In-game currency. Earned by staking, spent on minting.", col: "#ffcc00" },
          { icon: "💎", label: "RuneX", desc: "Solana SPL token. Earned in battles, lives on-chain.",  col: "#ff6060" },
        ].map(c => (
          <div key={c.label} style={{
            flex: 1, padding: "12px 10px", borderRadius: 10, textAlign: "center",
            background: "rgba(0,0,0,0.3)", border: `1px solid ${c.col}22`,
          }}>
            <span style={{ fontSize: "1.4rem" }}>{c.icon}</span>
            <p style={{ fontFamily: "'Cinzel',serif", color: c.col, fontWeight: 700, fontSize: "0.8rem", marginTop: 4 }}>{c.label}</p>
            <p style={{ color: "#6b4f10", fontSize: "0.58rem", marginTop: 4, lineHeight: 1.5 }}>{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Wallet buttons */}
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ fontFamily: "'Cinzel',serif", color: "#a08040", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textAlign: "center" }}>
          CONNECT WALLET
        </p>

        <WalletButton
          name="Phantom"
          logo="👻"
          available={hasPhantom}
          loading={loading === "phantom"}
          onClick={() => connect("phantom")}
        />
        <WalletButton
          name="Solflare"
          logo="🔆"
          available={hasSolflare}
          loading={loading === "solflare"}
          onClick={() => connect("solflare")}
        />

        {!hasPhantom && !hasSolflare && (
          <p style={{ textAlign: "center", color: "#6b4f10", fontSize: "0.68rem", marginTop: 4 }}>
            No Solana wallet detected.<br />
            Install <strong style={{ color: "#a08040" }}>Phantom</strong> or <strong style={{ color: "#a08040" }}>Solflare</strong> browser extension.
          </p>
        )}

        {error && (
          <p style={{ textAlign: "center", color: "#ef4444", fontSize: "0.72rem", marginTop: 4 }}>
            {error}
          </p>
        )}
      </div>

      {/* Character preview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, width: "100%", maxWidth: 360 }}>
        {[
          { cls: "archer",  rarity: "common", label: "Archer"  },
          { cls: "warrior", rarity: "common", label: "Warrior" },
          { cls: "mage",    rarity: "common", label: "Mage"    },
          { cls: "miner",   rarity: "common", label: "Miner"   },
        ].map(c => (
          <div key={c.cls} className="osrs-panel rounded-lg p-2 flex flex-col items-center gap-1">
            <OsrsSprite srcs={CHAR_SPRITES[c.cls]?.[c.rarity] ?? []} fallback="?" size={36} />
            <p style={{ fontFamily: "'Cinzel',serif", color: "#ffe8a0", fontSize: "0.6rem" }}>{c.label}</p>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
