const WIKI = "https://oldschool.runescape.wiki/w/Special:FilePath";

// All chathead URLs below verified to exist via OSRS wiki API.
// MISSING (do NOT use): Barbarian_(man), Black_Knight, Rune_Knight, Black_demon,
//   Archer_(Ranging_Guild), Archer, Elf_(Lletya), Werewolf, Dark_ranger,
//   Armadylean_guard, Chaos_Elemental, Vet'ion, Zamorak_monk, Dwarven_miner, etc.

export const CHAR_SPRITES: Record<string, Record<string, string[]>> = {
  warrior: {
    common:    [`${WIKI}/Man_chathead.png`,              `${WIKI}/Guard_chathead.png`],
    rare:      [`${WIKI}/Guard_chathead.png`,             `${WIKI}/Sergeant_Damien_chathead.png`],
    epic:      [`${WIKI}/Sergeant_Damien_chathead.png`,   `${WIKI}/Captain_Rovin_chathead.png`],
    legendary: [`${WIKI}/Death_chathead.png`,             `${WIKI}/Captain_Rovin_chathead.png`],
  },
  archer: {
    common:    [`${WIKI}/Ranger_chathead.png`, `${WIKI}/Man_chathead.png`],
    rare:      [`${WIKI}/Ranger_chathead.png`, `${WIKI}/Guard_chathead.png`],
    epic:      [`${WIKI}/Ranger_chathead.png`, `${WIKI}/Death_chathead.png`],
    legendary: [`${WIKI}/Death_chathead.png`,  `${WIKI}/Ranger_chathead.png`],
  },
  mage: {
    common:    [`${WIKI}/Wizard_chathead.png`,           `${WIKI}/Apprentice_chathead.png`],
    rare:      [`${WIKI}/Dark_wizard_chathead.png`,      `${WIKI}/Wizard_chathead.png`],
    epic:      [`${WIKI}/Mage_of_Zamorak_chathead.png`,  `${WIKI}/Dark_wizard_chathead.png`],
    legendary: [`${WIKI}/Mage_of_Zamorak_chathead.png`,  `${WIKI}/Aubury_chathead.png`],
  },
  miner: {
    common:    [`${WIKI}/Mining_helmet_chathead.png`,    `${WIKI}/Nurmof_chathead.png`],
    rare:      [`${WIKI}/Mining_helmet_chathead.png`,    `${WIKI}/Prospector_Percy_chathead.png`],
    epic:      [`${WIKI}/Prospector_Percy_chathead.png`, `${WIKI}/Mining_helmet_chathead.png`],
    legendary: [`${WIKI}/Prospector_Percy_chathead.png`, `${WIKI}/Nurmof_chathead.png`],
  },
};

export const ARMOR_ICONS: Record<string, Record<string, string>> = {
  warrior: {
    common:    `${WIKI}/Iron_full_helm.png`,
    rare:      `${WIKI}/Steel_full_helm.png`,
    epic:      `${WIKI}/Rune_full_helm.png`,
    legendary: `${WIKI}/Dragon_full_helm.png`,
  },
  archer: {
    common:    `${WIKI}/Leather_cowl.png`,
    rare:      `${WIKI}/Coif.png`,
    epic:      `${WIKI}/Snakeskin_bandana.png`,
    legendary: `${WIKI}/Armadyl_helmet.png`,
  },
  mage: {
    common:    `${WIKI}/Wizard_hat.png`,
    rare:      `${WIKI}/Mystic_hat.png`,
    epic:      `${WIKI}/Infinity_hat.png`,
    legendary: `${WIKI}/Ancestral_hat.png`,
  },
  miner: {
    common:    `${WIKI}/Bronze_pickaxe.png`,
    rare:      `${WIKI}/Steel_pickaxe.png`,
    epic:      `${WIKI}/Rune_pickaxe.png`,
    legendary: `${WIKI}/Dragon_pickaxe.png`,
  },
};

export const ITEM_SPRITES: Record<string, string> = {
  vitality:    `${WIKI}/Prayer_potion(4).png`,
  token_boost: `${WIKI}/Super_combat_potion(4).png`,
  drop_boost:  `${WIKI}/Ring_of_wealth.png`,
};

export const GAME_ICONS = {
  gold:     [`${WIKI}/Gold_bar.png`,               `${WIKI}/Coins_10000.png`],
  dungeon:  [`${WIKI}/Strength_icon_(detail).png`,  `${WIKI}/Attack_icon_(detail).png`, `${WIKI}/Attack_icon.png`],
  mining:   [`${WIKI}/Mining_icon_(detail).png`,    `${WIKI}/Mining_icon.png`,          `${WIKI}/Bronze_pickaxe.png`],
  battle:   [`${WIKI}/Attack_icon_(detail).png`,    `${WIKI}/Attack_icon.png`],
  chest:    [`${WIKI}/Closed_chest.png`],
  backpack: [`${WIKI}/Rucksack.png`,                `${WIKI}/Looting_bag.png`,          `${WIKI}/Bag.png`],
  skull:    [`${WIKI}/Skull_(status_icon).png`,     `${WIKI}/Skull.png`],
  sword:    [`${WIKI}/Bronze_scimitar.png`,         `${WIKI}/Bronze_sword.png`],
  shield:   [`${WIKI}/Bronze_kiteshield.png`],
  boot:     [`${WIKI}/Agility_icon.png`],
  home:     [`${WIKI}/Home_Teleport_icon.png`],
};

export const STAT_ICONS = {
  attack:  [`${WIKI}/Attack_icon.png`],
  defense: [`${WIKI}/Defence_icon.png`],
  hp:      [`${WIKI}/Hitpoints_icon.png`],
  magic:   [`${WIKI}/Magic_icon.png`],
  ranged:  [`${WIKI}/Ranged_icon.png`],
  speed:   [`${WIKI}/Agility_icon.png`],
};

export const SKILL_ICONS: Record<string, string[]> = {
  attack:    [`${WIKI}/Attack_icon_(detail).png`,    `${WIKI}/Attack_icon.png`],
  hitpoints: [`${WIKI}/Hitpoints_icon_(detail).png`, `${WIKI}/Hitpoints_icon.png`],
  mining:    [`${WIKI}/Mining_icon_(detail).png`,    `${WIKI}/Mining_icon.png`],
  magic:     [`${WIKI}/Magic_icon_(detail).png`,     `${WIKI}/Magic_icon.png`],
  ranged:    [`${WIKI}/Ranged_icon_(detail).png`,    `${WIKI}/Ranged_icon.png`],
};

export const CHEST_SPRITES = {
  closed: [
    `${WIKI}/Reward_casket_(easy).png`,
    `${WIKI}/Casket_(easy).png`,
    `${WIKI}/Casket.png`,
    `${WIKI}/Closed_chest.png`,
  ],
  open: [
    `${WIKI}/Reward_casket_(elite).png`,
    `${WIKI}/Casket_(elite).png`,
    `${WIKI}/Opened_chest.png`,
    `${WIKI}/Casket_(easy).png`,
  ],
};

export const ITEM_CHEST_SPRITES = {
  closed: [
    `${WIKI}/Reward_casket_(beginner).png`,
    `${WIKI}/Casket_(beginner).png`,
    `${WIKI}/Casket.png`,
    `${WIKI}/Closed_chest.png`,
  ],
  open: [
    `${WIKI}/Reward_casket_(medium).png`,
    `${WIKI}/Casket_(medium).png`,
    `${WIKI}/Opened_chest.png`,
    `${WIKI}/Casket_(beginner).png`,
  ],
};

// HeroX sprites — full-body NPCs downloaded locally to /sprites/heroes/
// Berserker = warrior, Ranger = archer, Sorcerer = mage, Paladin = holy knight.
export const HERO_SPRITES: Record<string, Record<string, string[]>> = {
  berserker: {
    common:    ["/sprites/heroes/man.png",         "/sprites/heroes/guard.png"],
    rare:      ["/sprites/heroes/sergeant_damien.png", "/sprites/heroes/guard.png"],
    epic:      ["/sprites/heroes/captain_rovin.png",   "/sprites/heroes/dark_warrior.png"],
    legendary: ["/sprites/heroes/dark_warrior.png",    "/sprites/heroes/death.png"],
  },
  ranger: {
    common:    ["/sprites/heroes/ranger.png"],
    rare:      ["/sprites/heroes/ranger.png"],
    epic:      ["/sprites/heroes/ranger.png"],
    legendary: ["/sprites/heroes/death.png",      "/sprites/heroes/ranger.png"],
  },
  sorcerer: {
    common:    ["/sprites/heroes/apprentice.png",  "/sprites/heroes/wizard.png"],
    rare:      ["/sprites/heroes/wizard.png",      "/sprites/heroes/chaos_druid.png"],
    epic:      ["/sprites/heroes/dark_wizard.png", "/sprites/heroes/zaff.png"],
    legendary: ["/sprites/heroes/mage_zamorak.png","/sprites/heroes/aubury.png"],
  },
  paladin: {
    common:    ["/sprites/heroes/monk.png"],
    rare:      ["/sprites/heroes/paladin.png"],
    epic:      ["/sprites/heroes/sir_tiffy.png"],
    legendary: ["/sprites/heroes/sir_amik.png"],
  },
};

export const HERO_MONSTER_SPRITES: Record<number, string[]> = {
  1: ["/sprites/heroes/goblin.png"],
  2: ["/sprites/heroes/guard.png",      "/sprites/heroes/man.png"],
  3: ["/sprites/heroes/wizard.png",     "/sprites/heroes/chaos_druid.png"],
  4: ["/sprites/heroes/dark_wizard.png","/sprites/heroes/dark_warrior.png"],
  5: ["/sprites/heroes/death.png",      "/sprites/heroes/mage_zamorak.png"],
};

export const RUNEX_ICON = [`${WIKI}/Blood_rune.png`, `${WIKI}/Death_rune.png`];

// Starter miner — distinct NPC so it's visually separate from regular miners
export const STARTER_MINER_SPRITE = [
  `${WIKI}/Nulodion_chathead.png`,
  `${WIKI}/Thurgo_chathead.png`,
  `${WIKI}/Mining_helmet_chathead.png`,
];

export const SKILL_CAPE_SPRITES: Record<string, string[]> = {
  attack:    [`${WIKI}/Attack_cape.png`],
  ranged:    [`${WIKI}/Ranging_cape.png`],
  magic:     [`${WIKI}/Magic_cape.png`],
  mining:    [`${WIKI}/Mining_cape.png`],
  hitpoints: [`${WIKI}/Hitpoints_cape.png`],
};

// ── Equipment item sprites (HeroX gear) ──────────────────────────────────────
// Keyed by slot, then rarity. Falls back to emoji in OsrsSprite if unavailable.
export const EQUIP_ITEM_SPRITES: Record<string, Record<string, string[]>> = {
  head: {
    common:    [`${WIKI}/Iron_full_helm.png`],
    rare:      [`${WIKI}/Steel_full_helm.png`],
    epic:      [`${WIKI}/Rune_full_helm.png`],
    legendary: [`${WIKI}/Dragon_full_helm.png`],
  },
  body: {
    common:    [`${WIKI}/Iron_platebody.png`],
    rare:      [`${WIKI}/Steel_platebody.png`],
    epic:      [`${WIKI}/Rune_platebody.png`],
    legendary: [`${WIKI}/Dragon_platebody.png`],
  },
  legs: {
    common:    [`${WIKI}/Iron_platelegs.png`],
    rare:      [`${WIKI}/Steel_platelegs.png`],
    epic:      [`${WIKI}/Rune_platelegs.png`],
    legendary: [`${WIKI}/Dragon_platelegs.png`],
  },
  shield: {
    common:    [`${WIKI}/Iron_kiteshield.png`],
    rare:      [`${WIKI}/Steel_kiteshield.png`],
    epic:      [`${WIKI}/Rune_kiteshield.png`],
    legendary: [`${WIKI}/Dragon_sq_shield.png`],
  },
  // Weapons — atk
  weapon_atk: {
    common:    [`${WIKI}/Iron_scimitar.png`],
    rare:      [`${WIKI}/Steel_scimitar.png`],
    epic:      [`${WIKI}/Rune_scimitar.png`],
    legendary: [`${WIKI}/Dragon_scimitar.png`],
  },
  // Weapons — destreza (ranged)
  weapon_destreza: {
    common:    [`${WIKI}/Shortbow.png`],
    rare:      [`${WIKI}/Maple_shortbow.png`],
    epic:      [`${WIKI}/Magic_shortbow.png`],
    legendary: [`${WIKI}/Twisted_bow.png`],
  },
  // Weapons — magia
  weapon_magia: {
    common:    [`${WIKI}/Staff_of_air.png`],
    rare:      [`${WIKI}/Staff_of_fire.png`],
    epic:      [`${WIKI}/Master_wand.png`],
    legendary: [`${WIKI}/Trident_of_the_seas.png`],
  },
  // Weapons — vitalidade
  weapon_vitalidade: {
    common:    [`${WIKI}/Iron_mace.png`],
    rare:      [`${WIKI}/Steel_mace.png`],
    epic:      [`${WIKI}/Rune_mace.png`],
    legendary: [`${WIKI}/Dragon_mace.png`],
  },
  neck: {
    common:    [`${WIKI}/Amulet_of_strength.png`],
    rare:      [`${WIKI}/Amulet_of_power.png`],
    epic:      [`${WIKI}/Amulet_of_fury.png`],
    legendary: [`${WIKI}/Amulet_of_torture.png`],
  },
  cape: {
    common:    [`${WIKI}/Obsidian_cape.png`],
    rare:      [`${WIKI}/Fire_cape.png`],
    epic:      [`${WIKI}/Infernal_cape.png`],
    legendary: [`${WIKI}/Mythical_cape.png`],
  },
  hands: {
    common:    [`${WIKI}/Iron_gauntlets.png`],
    rare:      [`${WIKI}/Steel_gauntlets.png`],
    epic:      [`${WIKI}/Barrows_gloves.png`],
    legendary: [`${WIKI}/Tormented_bracelet.png`],
  },
  feet: {
    common:    [`${WIKI}/Iron_boots.png`],
    rare:      [`${WIKI}/Rune_boots.png`],
    epic:      [`${WIKI}/Dragon_boots.png`],
    legendary: [`${WIKI}/Primordial_boots.png`],
  },
  ring: {
    common:    [`${WIKI}/Ring_of_recoil.png`],
    rare:      [`${WIKI}/Berserker_ring.png`],
    epic:      [`${WIKI}/Berserker_ring_(i).png`],
    legendary: [`${WIKI}/Ultor_ring.png`],
  },
};

export function getEquipSprite(item: { item_slot: string | null; item_rarity: string | null; stat_atk: number; stat_destreza: number; stat_magia: number }): string[] {
  const slot   = item.item_slot;
  const rarity = item.item_rarity || "common";
  if (!slot) return [];
  if (slot === "weapon") {
    const sub = item.stat_atk > 0 ? "atk" : item.stat_destreza > 0 ? "destreza" : item.stat_magia > 0 ? "magia" : "vitalidade";
    return EQUIP_ITEM_SPRITES[`weapon_${sub}`]?.[rarity] ?? [];
  }
  return EQUIP_ITEM_SPRITES[slot]?.[rarity] ?? [];
}
