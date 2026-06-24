import axios from "axios";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = axios.create({ baseURL: (import.meta as any).env?.VITE_API_URL ?? "/api" });

export interface CharacterItem {
  id: number;
  item_type: "vitality" | "token_boost" | "drop_boost";
  value: number;
  label: string;
  icon: string;
  is_equipped: boolean;
  equipped_on: number | null;
  obtained_at: string;
}

export interface Character {
  id: number;
  class_type: "archer" | "warrior" | "mage" | "miner";
  rarity: "common" | "rare" | "epic" | "legendary";
  name: string;
  emoji: string;
  rarity_emoji: string;
  expires_at: string;
  days_left: number;
  hours_left: number;
  is_staked: boolean;
  staked_at: string | null;
  token_boost: number;
  drop_boost: number;
  pending_tokens: number;
  equipped_items: CharacterItem[];
  obtained_at: string;
}

export interface Player {
  wallet: string;
  tokens: number;
  characters: Character[];
  inventory: CharacterItem[];
  character_count: number;
}

export const loginPlayer = (wallet: string) =>
  api.post<{ wallet: string; tokens: number; character_count: number }>("/player/login", { wallet }).then(r => r.data);

export const getPlayer = (wallet: string) =>
  api.get<Player>(`/player/${wallet}`).then(r => r.data);

export const openBox = (wallet: string) =>
  api.post<{ ok: boolean; character: Character; tokens: number }>(`/player/${wallet}/box/open`).then(r => r.data);

export const stakeChar = (wallet: string, charId: number) =>
  api.post<{ ok: boolean; character: Character }>(`/player/${wallet}/characters/${charId}/stake`).then(r => r.data);

export const unstakeChar = (wallet: string, charId: number) =>
  api.post<{ ok: boolean; tokens_claimed: number; items_dropped: CharacterItem[]; tokens: number; character: Character }>(
    `/player/${wallet}/characters/${charId}/unstake`
  ).then(r => r.data);

export const claimTokens = (wallet: string, charId: number) =>
  api.post<{ ok: boolean; tokens_claimed: number; items_dropped: CharacterItem[]; tokens: number; expired: boolean }>(
    `/player/${wallet}/characters/${charId}/claim`
  ).then(r => r.data);

export const equipItem = (wallet: string, charId: number, itemId: number) =>
  api.post<{ ok: boolean; character: Character }>(`/player/${wallet}/characters/${charId}/equip`, { item_id: itemId }).then(r => r.data);

export const unequipItem = (wallet: string, charId: number, itemId: number) =>
  api.post<{ ok: boolean; character: Character }>(`/player/${wallet}/characters/${charId}/unequip`, { item_id: itemId }).then(r => r.data);

export const getInventory = (wallet: string) =>
  api.get<CharacterItem[]>(`/player/${wallet}/inventory`).then(r => r.data);
