import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Player } from "./api";

interface GameStore {
  wallet: string;
  player: Player | null;
  setWallet: (w: string) => void;
  setPlayer: (p: Player | null) => void;
  updateTokens: (t: number) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      wallet:      "",
      player:      null,
      setWallet:   (wallet) => set({ wallet }),
      setPlayer:   (player) => set({ player }),
      updateTokens:(tokens) => set((s) => s.player ? { player: { ...s.player, tokens } } : {}),
    }),
    { name: "rpgame-store" }
  )
);
