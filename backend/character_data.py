import random

CLASSES   = ["archer", "warrior", "mage", "miner"]
RARITIES  = ["common", "rare", "epic", "legendary"]

RARITY_WEIGHTS = [60, 25, 12, 3]
CLASS_WEIGHTS  = [25, 25, 25, 25]

EXPIRY_DAYS = {
    "common":    15,
    "rare":      20,
    "epic":      30,
    "legendary": 60,
}

# Tokens per day while staked
TRAINING_TOKENS_DAY: dict[str, int] = {
    "common":    10_000,
    "rare":      12_500,
    "epic":      15_000,
    "legendary": 20_000,
}

MINING_TOKENS_DAY: dict[str, int] = {
    "common":    12_000,
    "rare":      17_000,
    "epic":      23_000,
    "legendary": 30_000,
}

BOX_COST = 50_000  # tokens to open a box

CHEST_DROP_PER_MIN = 0.00003  # 0.003% per minute

ITEM_TYPES = ["vitality", "token_boost", "drop_boost"]

ITEM_RANGES: dict[str, tuple] = {
    "vitality":    (1, 5),          # +1–5 days
    "token_boost": (5, 25),         # +5–25% generation
    "drop_boost":  (0.00001, 0.00005),  # extra drop rate per minute
}

CLASS_EMOJI = {
    "archer":  "🏹",
    "warrior": "⚔️",
    "mage":    "🔮",
    "miner":   "⛏️",
}

RARITY_EMOJI = {
    "common":    "⬜",
    "rare":      "🔵",
    "epic":      "🟣",
    "legendary": "🟡",
}


# ── Combat stats ─────────────────────────────────────────────────────────────
# Base stats at common rarity. Primary stat guaranteed 80+.
BASE_STATS: dict[str, dict[str, int]] = {
    "warrior": {"attack": 85, "defense": 68, "hp": 100, "magic": 15, "ranged": 18, "speed": 45},
    "archer":  {"attack": 22, "defense": 44, "hp":  72, "magic": 18, "ranged": 85, "speed": 80},
    "mage":    {"attack": 18, "defense": 32, "hp":  62, "magic": 85, "ranged": 20, "speed": 58},
    "miner":   {"attack": 48, "defense": 82, "hp": 120, "magic": 10, "ranged": 12, "speed": 28},
}

RARITY_STAT_MULT: dict[str, float] = {
    "common":    1.0,
    "rare":      1.25,
    "epic":      1.55,
    "legendary": 2.0,
}

PRIMARY_STAT: dict[str, str] = {
    "warrior": "attack",
    "archer":  "ranged",
    "mage":    "magic",
    "miner":   "defense",
}


def roll_stats(class_type: str, rarity: str) -> dict[str, int]:
    base    = BASE_STATS[class_type]
    mult    = RARITY_STAT_MULT[rarity]
    primary = PRIMARY_STAT[class_type]
    result  = {}
    for stat, val in base.items():
        variance = random.uniform(0.93, 1.07)
        raw = int(val * mult * variance)
        if stat == primary:
            raw = max(80, raw)   # guarantee 80+ on primary stat
        result[stat] = min(99, raw)
    return result


def roll_rarity() -> str:
    return random.choices(RARITIES, weights=RARITY_WEIGHTS, k=1)[0]


def roll_class() -> str:
    return random.choices(CLASSES, weights=CLASS_WEIGHTS, k=1)[0]


def roll_item() -> dict:
    item_type = random.choice(ITEM_TYPES)
    lo, hi = ITEM_RANGES[item_type]
    if item_type == "drop_boost":
        value = round(random.uniform(lo, hi), 6)
    else:
        value = float(random.randint(int(lo), int(hi)))
    return {"type": item_type, "value": value}


def tokens_per_minute(class_type: str, rarity: str, boost_pct: float = 0.0) -> float:
    if class_type == "miner":
        base = MINING_TOKENS_DAY[rarity] / 1440
    else:
        base = TRAINING_TOKENS_DAY[rarity] / 1440
    return base * (1 + boost_pct / 100)
