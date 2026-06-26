import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Player } from "./api";

interface GameStore {
  wallet: string;
  player: Player | null;
  mintAddress: string;
  setWallet:      (w: string) => void;
  setPlayer:      (p: Player | null) => void;
  updateTokens:   (t: number) => void;
  setMintAddress: (m: string) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      wallet:         "",
      player:         null,
      mintAddress:    "6AVAUKa9uxQpruHZUinFECpXEh1usRVtzQWK8N2wpump",
      setWallet:      (wallet)      => set({ wallet }),
      setPlayer:      (player)      => set({ player }),
      updateTokens:   (tokens)      => set((s) => s.player ? { player: { ...s.player, tokens } } : {}),
      setMintAddress: (mintAddress) => set({ mintAddress }),
    }),
    { name: "rpgame-store" }
  )
);
