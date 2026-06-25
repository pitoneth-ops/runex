import axios from "axios";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = axios.create({ baseURL: (import.meta as any).env?.VITE_API_URL ?? "/api" });

export type ItemRarity = "common" | "rare" | "epic" | "legendary";
export type EquipSlot  = "head" | "neck" | "cape" | "weapon" | "body" | "shield" | "legs" | "hands" | "feet" | "ring";

export interface CharacterItem {
  id: number;
  item_type: "vitality" | "token_boost" | "drop_boost" | "equipment" | "upgrade_stone";
  value: number;
  label: string;
  icon: string;
  is_equipped: boolean;
  equipped_on: number | null;
  hero_equipped_on: number | null;
  obtained_at: string;
  // Equipment fields (null for old item types)
  item_slot:       EquipSlot | null;
  item_rarity:     ItemRarity | null;
  item_name:       string | null;
  stat_vitalidade: number;
  stat_atk:        number;
  stat_destreza:   number;
  stat_magia:      number;
}

export interface CharStats {
  attack:  number;
  defense: number;
  hp:      number;
  magic:   number;
  ranged:  number;
  speed:   number;
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
  stats: CharStats;
  primary_stat: string;
}

export interface Skills {
  attack:    number;
  ranged:    number;
  magic:     number;
  mining:    number;
  hitpoints: number;
}

export interface HeroStats {
  attack:  number;
  defense: number;
  hp:      number;
  magic:   number;
  ranged:  number;
  speed:   number;
}

export interface HeroX {
  id: number;
  hero_class: "berserker" | "ranger" | "sorcerer" | "paladin";
  rarity: "common" | "rare" | "epic" | "legendary";
  rarity_emoji: string;
  primary_stat: string;
  stats: HeroStats;
  last_battle_date: string | null;
  can_battle: boolean;
  best_phase: number;
  total_runex_earned: number;
  hero_level: number;
  obtained_at: string;
  equipped_items: CharacterItem[];
}

export interface Player {
  wallet: string;
  tokens: number;
  runex: number;
  characters: Character[];
  inventory: CharacterItem[];
  heroes: HeroX[];
  character_count: number;
  skills: Skills;
  pending_skills: Skills;
  staked_gold: number;
  staked_gold_until: string | null;
  bank_boost_pct: number;
  starter_miner_claimed: boolean;
}

export const loginPlayer = (wallet: string) =>
  api.post<{ wallet: string; tokens: number; character_count: number }>("/player/login", { wallet }).then(r => r.data);

export const authWallet = (wallet: string, signature: string, message: string) =>
  api.post<Player>("/player/auth", { wallet, signature, message }).then(r => r.data);

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

export const equipHeroItem = (wallet: string, heroId: number, itemId: number) =>
  api.post<{ ok: boolean; hero: HeroX }>(`/player/${wallet}/hero/${heroId}/equip`, { item_id: itemId }).then(r => r.data);

export const unequipHeroItem = (wallet: string, heroId: number, itemId: number) =>
  api.post<{ ok: boolean; hero: HeroX }>(`/player/${wallet}/hero/${heroId}/unequip`, { item_id: itemId }).then(r => r.data);

export const getInventory = (wallet: string) =>
  api.get<CharacterItem[]>(`/player/${wallet}/inventory`).then(r => r.data);

export const claimBattleReward = (wallet: string, tokensWon: number, won: boolean) =>
  api.post<{ tokens: number; battle_wins: number }>(`/player/${wallet}/battle/reward`, { tokens_won: tokensWon, won }).then(r => r.data);

export const mintHero = (wallet: string) =>
  api.post<{ ok: boolean; hero: HeroX; tokens: number }>(`/player/${wallet}/hero/mint`).then(r => r.data);

export const burnHero = (wallet: string, heroId: number) =>
  api.delete<{ ok: boolean }>(`/player/${wallet}/hero/${heroId}`).then(r => r.data);

export const buyRunexChest = (wallet: string) =>
  api.post<{ ok: boolean; runex_gained: number; tokens: number; runex: number }>(
    `/player/${wallet}/shop/runex-chest`
  ).then(r => r.data);

export const submitHeroBattle = (wallet: string, heroId: number, phasesCompleted: number) =>
  api.post<{ ok: boolean; phases_completed: number; runex_earned: number; total_runex: number; hero: HeroX; items_dropped: CharacterItem[] }>(
    `/player/${wallet}/hero/${heroId}/battle`,
    { phases_completed: phasesCompleted }
  ).then(r => r.data);

export const buyItemChest = (wallet: string) =>
  api.post<{ ok: boolean; runex_gained: number; item_dropped: CharacterItem | null; tokens: number; runex: number }>(
    `/player/${wallet}/shop/item-chest`
  ).then(r => r.data);

export const claimAll = (wallet: string, classGroup: "fighter" | "miner") =>
  api.post<{ ok: boolean; tokens_claimed: number; items_dropped: CharacterItem[]; tokens: number }>(
    `/player/${wallet}/characters/claim-all`,
    { class_group: classGroup }
  ).then(r => r.data);

export const stakeAll = (wallet: string, classGroup: "fighter" | "miner") =>
  api.post<{ ok: boolean; staked_count: number }>(
    `/player/${wallet}/characters/stake-all`,
    { class_group: classGroup }
  ).then(r => r.data);

export const upgradeMiner = (wallet: string, charId: number) =>
  api.post<{ ok: boolean; new_rarity: string; character: Character }>(
    `/player/${wallet}/characters/${charId}/upgrade`
  ).then(r => r.data);

export const bankStake = (wallet: string, amount: number) =>
  api.post<{ ok: boolean; staked_gold: number; staked_gold_until: string; tokens: number; bank_boost_pct: number }>(
    `/player/${wallet}/bank/stake`, { amount }
  ).then(r => r.data);

export const bankUnstake = (wallet: string) =>
  api.post<{ ok: boolean; tokens: number; bank_boost_pct: number }>(
    `/player/${wallet}/bank/unstake`
  ).then(r => r.data);

export interface Transaction {
  id: number;
  tx_type: string;
  description: string;
  value: number;
  created_at: string;
}

export const getTransactions = (wallet: string) =>
  api.get<Transaction[]>(`/player/${wallet}/transactions`).then(r => r.data);

export interface BRFight {
  fight_number: number;
  opponent_name: string;
  opponent_class: string;
  opponent_rarity: string;
  won: boolean;
  hp_left: number;
  rounds: number;
  lines: string[];
}

export interface BRResult {
  ok: boolean;
  won: boolean;
  fights: BRFight[];
  runex_earned: number;
  tokens: number;
  runex: number;
}

export const battleRoyale = (wallet: string, heroId: number) =>
  api.post<BRResult>(`/player/${wallet}/battle-royale`, { hero_id: heroId }).then(r => r.data);

export const claimStarterMiner = (wallet: string) =>
  api.post<{ ok: boolean; character: Character }>(`/player/${wallet}/claim-starter-miner`).then(r => r.data);
