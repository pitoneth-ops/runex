import random
from datetime import datetime, timezone

HERO_CLASSES   = ["berserker", "ranger", "sorcerer", "paladin"]
HERO_RARITIES  = ["common", "rare", "epic", "legendary"]
HERO_WEIGHTS   = [50, 30, 15, 5]
HERO_MINT_COST = 100_000   # gold (tokens) to mint a HeroX
MAX_HEROES     = 3

HERO_BASE_STATS = {
    "berserker": {"attack": 90, "defense": 60, "hp": 110, "magic": 15, "ranged": 20, "speed": 55},
    "ranger":    {"attack": 25, "defense": 50, "hp": 80,  "magic": 15, "ranged": 90, "speed": 85},
    "sorcerer":  {"attack": 15, "defense": 35, "hp": 70,  "magic": 90, "ranged": 25, "speed": 65},
    "paladin":   {"attack": 60, "defense": 85, "hp": 130, "magic": 30, "ranged": 30, "speed": 40},
}

HERO_PRIMARY = {
    "berserker": "attack",
    "ranger":    "ranged",
    "sorcerer":  "magic",
    "paladin":   "defense",
}

# Fighting stat used in combat (may differ from primary)
HERO_FIGHT_STAT = {
    "berserker": "attack",
    "ranger":    "ranged",
    "sorcerer":  "magic",
    "paladin":   "attack",   # paladin tanks and hits with melee
}

HERO_RARITY_MULT = {
    "common":    1.0,
    "rare":      1.3,
    "epic":      1.65,
    "legendary": 2.2,
}

HP_CAP  = 250    # HP is allowed to go higher than other stats
STAT_CAP = 99

HERO_RARITY_EMOJI = {
    "common":    "⬜",
    "rare":      "🔵",
    "epic":      "🟣",
    "legendary": "🟡",
}

# RuneX earned for each phase COMPLETED (incremental)
PHASE_RUNEX_INCREMENT = {1: 500, 2: 2000, 3: 8000, 4: 35000, 5: 100000}

# Monsters per phase — class-specific weakness gives ×1.5 attack bonus
BATTLE_MONSTERS = {
    1: {"name": "Goblin Chieftain", "hp": 20,  "atk": 8,   "def": 5,   "weakness": "berserker"},
    2: {"name": "Ice Queen",        "hp": 60,  "atk": 25,  "def": 20,  "weakness": "ranger"},
    3: {"name": "Chaos Wizard",     "hp": 120, "atk": 55,  "def": 45,  "weakness": "paladin"},
    4: {"name": "Blue Dragon",      "hp": 200, "atk": 90,  "def": 80,  "weakness": "sorcerer"},
    5: {"name": "Zulrah",           "hp": 250, "atk": 110, "def": 100, "weakness": "ranger"},
}


def roll_hero_class() -> str:
    return random.choices(HERO_CLASSES, weights=[25, 25, 25, 25], k=1)[0]


def roll_hero_rarity() -> str:
    return random.choices(HERO_RARITIES, weights=HERO_WEIGHTS, k=1)[0]


def roll_hero_stats(hero_class: str, rarity: str) -> dict[str, int]:
    base    = HERO_BASE_STATS[hero_class]
    mult    = HERO_RARITY_MULT[rarity]
    primary = HERO_PRIMARY[hero_class]
    result  = {}
    for stat, val in base.items():
        variance = random.uniform(0.93, 1.07)
        raw      = int(val * mult * variance)
        if stat == primary:
            raw = max(80, raw)
        cap = HP_CAP if stat == "hp" else STAT_CAP
        result[stat] = min(cap, raw)
    return result


def simulate_hero_phase(stats: dict, phase: int, hero_class: str) -> dict:
    monster      = BATTLE_MONSTERS[phase]
    fight_stat   = FIGHT_VALUE(stats, hero_class)
    type_match   = (monster["weakness"] == hero_class)
    effective_atk = fight_stat * (1.5 if type_match else 0.8)

    char_hit  = effective_atk / (effective_atk + monster["def"] + 1)
    mon_hit   = monster["atk"] / (monster["atk"] + stats["defense"] + 1)

    char_dpt  = char_hit * effective_atk * 0.5
    mon_dpt   = mon_hit  * monster["atk"] * 0.5

    turns_kill     = monster["hp"] / max(0.1, char_dpt)
    turns_survived = stats["hp"]   / max(0.1, mon_dpt)

    win     = turns_survived >= turns_kill
    hp_left = max(0, int(stats["hp"] - turns_kill * mon_dpt))

    return {
        "phase":          phase,
        "monster":        monster["name"],
        "win":            win,
        "hp_left":        hp_left,
        "type_match":     type_match,
        "turns_to_kill":  round(turns_kill, 1),
        "turns_survived": round(turns_survived, 1),
    }


def FIGHT_VALUE(stats: dict, hero_class: str) -> float:
    key = HERO_FIGHT_STAT[hero_class]
    return float(stats.get(key, 50))


def today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# ── Equipment item generation ─────────────────────────────────────────────────

EQUIP_SLOTS    = ["head", "neck", "cape", "weapon", "body", "shield", "legs", "hands", "feet", "ring"]
EQUIP_RARITIES = ["common", "rare", "epic", "legendary"]
EQUIP_WEIGHTS  = [78, 16, 5, 1]          # ~1% legendary, ~5% epic, ~16% rare
STAT_BY_RARITY = {"common": 1, "rare": 2, "epic": 3, "legendary": 4}

_WEAPON_NAMES = {
    "atk":       ["Iron Sword",   "Steel Sword",   "Rune Sword",    "Dragon Sword"],
    "destreza":  ["Oak Bow",      "Maple Bow",      "Magic Bow",     "Twisted Bow"],
    "magia":     ["Air Staff",    "Fire Staff",     "Master Wand",   "Trident"],
    "vitalidade":["Iron Mace",    "War Hammer",     "Rune Mace",     "Dragon Mace"],
}
_ARMOR_NAMES = {
    "head":   ["Iron Helm",       "Steel Helm",      "Rune Helm",      "Dragon Helm"],
    "body":   ["Iron Body",       "Steel Body",      "Rune Body",      "Dragon Body"],
    "legs":   ["Iron Legs",       "Steel Legs",      "Rune Legs",      "Dragon Legs"],
    "shield": ["Iron Shield",     "Steel Shield",    "Rune Shield",    "Dragon Shield"],
    "hands":  ["Iron Gloves",     "Steel Gloves",    "Barrows Gloves", "Blessed Gloves"],
    "feet":   ["Iron Boots",      "Steel Boots",     "Rune Boots",     "Dragon Boots"],
    "neck":   ["Str Amulet",      "Power Amulet",    "Fury Amulet",    "Torture Amulet"],
    "cape":   ["Obsidian Cape",   "Fire Cape",       "Infernal Cape",  "Mythical Cape"],
    "ring":   ["Recoil Ring",     "Berserker Ring",  "Berserker Ring(i)", "Ultor Ring"],
}

# Drop chance per phase completed (independent rolls) — intentionally rare
# Expected items per full 5-phase clear: ~0.48 (roughly 1 item every 2 full clears)
PHASE_EQUIP_DROP = {1: 0.03, 2: 0.05, 3: 0.08, 4: 0.12, 5: 0.20}


def roll_equipment_item(weights=None) -> dict:
    slot      = random.choice(EQUIP_SLOTS)
    rarity    = random.choices(EQUIP_RARITIES, weights=weights or EQUIP_WEIGHTS, k=1)[0]
    ridx      = EQUIP_RARITIES.index(rarity)
    stat_val  = STAT_BY_RARITY[rarity]

    if slot == "weapon":
        stat_type = random.choice(["atk", "destreza", "magia", "vitalidade"])
        name = _WEAPON_NAMES[stat_type][ridx]
    elif slot in ("head", "body", "legs", "shield"):
        stat_type = "vitalidade"
        name = _ARMOR_NAMES[slot][ridx]
    elif slot == "neck":
        stat_type = random.choice(["vitalidade", "magia"])
        name = _ARMOR_NAMES["neck"][ridx]
    elif slot == "cape":
        stat_type = random.choice(["vitalidade", "destreza"])
        name = _ARMOR_NAMES["cape"][ridx]
    elif slot == "hands":
        stat_type = random.choice(["atk", "destreza", "magia"])
        name = _ARMOR_NAMES["hands"][ridx]
    elif slot == "feet":
        stat_type = random.choice(["vitalidade", "destreza"])
        name = _ARMOR_NAMES["feet"][ridx]
    else:  # ring
        stat_type = random.choice(["atk", "destreza", "magia", "vitalidade"])
        name = _ARMOR_NAMES["ring"][ridx]

    return {
        "item_type":      "equipment",
        "item_slot":      slot,
        "item_rarity":    rarity,
        "item_name":      name,
        "value":          float(stat_val),
        "stat_vitalidade": stat_val if stat_type == "vitalidade" else 0,
        "stat_atk":        stat_val if stat_type == "atk"        else 0,
        "stat_destreza":   stat_val if stat_type == "destreza"   else 0,
        "stat_magia":      stat_val if stat_type == "magia"       else 0,
    }
