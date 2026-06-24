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
