import random
from datetime import datetime, timezone, timedelta
from character_data import (
    roll_rarity, roll_class, roll_item, roll_stats,
    tokens_per_minute, CHEST_DROP_PER_MIN,
    EXPIRY_DAYS, BOX_COST, CLASS_EMOJI, RARITY_EMOJI,
    PRIMARY_STAT,
)
from hero_data import roll_equipment_item


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    if dt is None:
        return _now()
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _char_boosts(char) -> tuple[float, float]:
    """Return (token_boost_pct, extra_drop_rate) from equipped items."""
    token_boost = 0.0
    drop_boost  = 0.0
    for item in (char.items or []):
        if not item.is_equipped or item.equipped_on != char.id:
            continue
        if item.item_type == "token_boost":
            token_boost += item.value
        elif item.item_type == "drop_boost":
            drop_boost += item.value
    return token_boost, drop_boost


BOX_COST_RUNEX = 50_000   # RuneX to mint a staking character

# ── Box / minting ─────────────────────────────────────────────────────────────

def open_box(player) -> dict:
    if (player.runex or 0) < BOX_COST_RUNEX:
        return {"error": f"Precisa de {BOX_COST_RUNEX:,} RuneX para abrir um baú"}

    rarity     = roll_rarity()
    class_type = roll_class()
    player.runex = (player.runex or 0) - BOX_COST_RUNEX

    return {
        "ok":         True,
        "class_type": class_type,
        "rarity":     rarity,
        "emoji":      CLASS_EMOJI[class_type],
        "rarity_emoji": RARITY_EMOJI[rarity],
        "expires_days": EXPIRY_DAYS[rarity],
        "tokens":     player.tokens,
        "runex":      player.runex,
    }


# ── Staking ───────────────────────────────────────────────────────────────────

def stake(player, char) -> dict:
    now     = _now()
    expires = _aware(char.expires_at)

    if now >= expires:
        return {"error": "Character has expired"}
    if char.is_staked:
        return {"error": "Already staked"}

    char.is_staked     = True
    char.staked_at     = now
    char.last_claim_at = now
    char.last_chest_at = now

    return {"ok": True}


def unstake(player, char) -> dict:
    if not char.is_staked:
        return {"error": "Not staked"}

    result = _do_claim(player, char)

    char.is_staked = False
    char.staked_at = None

    return {**result, "unstaked": True}


# ── Claiming ──────────────────────────────────────────────────────────────────

def claim(player, char) -> dict:
    if not char.is_staked:
        return {"error": "Character is not staked"}

    now     = _now()
    expires = _aware(char.expires_at)

    if now >= expires:
        result = _do_claim(player, char, cap_at=expires)
        char.is_staked = False
        return {**result, "expired": True}

    return _do_claim(player, char)


def _do_claim(player, char, cap_at: datetime | None = None) -> dict:
    now        = cap_at or _now()
    last_claim = _aware(char.last_claim_at or char.staked_at)
    last_chest = _aware(char.last_chest_at or char.staked_at)

    token_boost, drop_boost = _char_boosts(char)
    bank_boost = min(int((getattr(player, "staked_gold", 0) or 0) // 1_000_000) * 10, 100)
    _CLASS_SKILL = {"warrior": "skill_attack", "archer": "skill_ranged", "mage": "skill_magic", "miner": "skill_mining"}
    _skill_attr  = _CLASS_SKILL.get(char.class_type, "")
    skill_bonus  = int(getattr(player, _skill_attr, 1.0) or 1.0) * 0.2 if _skill_attr else 0.0
    rate = tokens_per_minute(char.class_type, char.rarity, token_boost + bank_boost + skill_bonus)

    minutes_elapsed = max(0.0, (now - last_claim).total_seconds() / 60)
    tokens_earned   = int(minutes_elapsed * rate)

    player.tokens  += tokens_earned
    char.last_claim_at = now

    # Skill gains: 1 character-day staked = 1 level, cap 99
    days = minutes_elapsed / 1440.0
    if char.class_type == "warrior":
        player.skill_attack    = min(99.0, (player.skill_attack    or 1.0) + days)
    elif char.class_type == "archer":
        player.skill_ranged    = min(99.0, (player.skill_ranged    or 1.0) + days)
    elif char.class_type == "mage":
        player.skill_magic     = min(99.0, (player.skill_magic     or 1.0) + days)
    elif char.class_type == "miner":
        player.skill_mining    = min(99.0, (player.skill_mining    or 1.0) + days)
    player.skill_hitpoints = min(99.0, (player.skill_hitpoints or 10.0) + days)

    # Chest/stone rolls — fighters drop items, miners drop upgrade stones
    new_items: list[dict] = []
    if char.class_type != "miner":
        chest_minutes = max(0.0, (now - last_chest).total_seconds() / 60)
        effective_rate = CHEST_DROP_PER_MIN + drop_boost
        for _ in range(int(chest_minutes)):
            if random.random() < effective_rate:
                if random.random() < 0.25:
                    new_items.append(roll_equipment_item())
                else:
                    new_items.append(roll_item())
        char.last_chest_at = now
    else:
        # Miners drop upgrade stones at the same base rate as dungeon item drops
        stone_minutes = max(0.0, (now - last_chest).total_seconds() / 60)
        for _ in range(int(stone_minutes)):
            if random.random() < CHEST_DROP_PER_MIN:
                new_items.append({"item_type": "upgrade_stone", "value": 1})
        char.last_chest_at = now

    return {
        "ok":            True,
        "tokens_claimed": tokens_earned,
        "items_dropped": new_items,
        "tokens":        player.tokens,
    }


# ── Items ─────────────────────────────────────────────────────────────────────

def equip_item(player, char, item) -> dict:
    if char.player_id != player.id:
        return {"error": "Not your character"}
    if item.player_id != player.id:
        return {"error": "Not your item"}
    if char.is_staked:
        return {"error": "Unstake character before equipping items"}
    if char.class_type == "miner":
        return {"error": "Miners cannot equip items"}
    if item.is_equipped:
        return {"error": "Item is already equipped"}

    if item.item_type == "vitality":
        char.expires_at = _aware(char.expires_at) + timedelta(days=int(item.value))

    item.is_equipped = True
    item.equipped_on = char.id

    return {"ok": True, "expires_at": _aware(char.expires_at).isoformat()}


def unequip_item(player, char, item) -> dict:
    if char.is_staked:
        return {"error": "Unstake character before managing items"}
    if item.equipped_on != char.id:
        return {"error": "Item is not equipped on this character"}

    if item.item_type == "vitality":
        char.expires_at = _aware(char.expires_at) - timedelta(days=int(item.value))

    item.is_equipped = False
    item.equipped_on = None

    return {"ok": True}


# ── Serializers ───────────────────────────────────────────────────────────────

def char_to_dict(char, bank_boost_pct: int = 0, skill_bonus_pct: float = 0.0) -> dict:
    now     = _now()
    expires = _aware(char.expires_at)
    token_boost, drop_boost = _char_boosts(char)

    time_left = max(timedelta(0), expires - now)
    days_left  = time_left.days
    hours_left = time_left.seconds // 3600

    pending_tokens = 0
    if char.is_staked:
        last = _aware(char.last_claim_at or char.staked_at)
        cap  = min(now, expires)
        mins = max(0.0, (cap - last).total_seconds() / 60)
        rate = tokens_per_minute(char.class_type, char.rarity, token_boost + bank_boost_pct + skill_bonus_pct)
        pending_tokens = int(mins * rate)

    return {
        "id":            char.id,
        "class_type":    char.class_type,
        "rarity":        char.rarity,
        "name":          char.name or "",
        "emoji":         CLASS_EMOJI.get(char.class_type, "❓"),
        "rarity_emoji":  RARITY_EMOJI.get(char.rarity, ""),
        "expires_at":    expires.isoformat(),
        "days_left":     days_left,
        "hours_left":    hours_left,
        "is_staked":     char.is_staked,
        "staked_at":     _aware(char.staked_at).isoformat() if char.staked_at else None,
        "token_boost":   token_boost,
        "drop_boost":    round(drop_boost, 6),
        "pending_tokens": pending_tokens,
        "equipped_items": [item_to_dict(i) for i in (char.items or []) if i.is_equipped and i.equipped_on == char.id],
        "obtained_at":   _aware(char.obtained_at).isoformat(),
        "stats": {
            "attack":  char.stat_attack  or 50,
            "defense": char.stat_defense or 50,
            "hp":      char.stat_hp      or 80,
            "magic":   char.stat_magic   or 15,
            "ranged":  char.stat_ranged  or 15,
            "speed":   char.stat_speed   or 45,
        },
        "primary_stat": PRIMARY_STAT.get(char.class_type, "attack"),
    }


_RARITY_EMOJI = {"common": "⬜", "rare": "🔵", "epic": "🟣", "legendary": "🟡"}

def item_to_dict(item) -> dict:
    base = {
        "id":             item.id,
        "item_type":      item.item_type or "equipment",
        "value":          item.value or 0,
        "is_equipped":    item.is_equipped,
        "equipped_on":    item.equipped_on,
        "hero_equipped_on": getattr(item, "hero_equipped_on", None),
        "obtained_at":    _aware(item.obtained_at).isoformat(),
        "item_slot":      getattr(item, "item_slot",       None),
        "item_rarity":    getattr(item, "item_rarity",     None),
        "item_name":      getattr(item, "item_name",       None),
        "stat_vitalidade": getattr(item, "stat_vitalidade", 0) or 0,
        "stat_atk":        getattr(item, "stat_atk",        0) or 0,
        "stat_destreza":   getattr(item, "stat_destreza",   0) or 0,
        "stat_magia":      getattr(item, "stat_magia",       0) or 0,
    }

    if item.item_type == "equipment":
        rarity  = item.item_rarity or "common"
        re      = _RARITY_EMOJI.get(rarity, "")
        stat_val = max(item.stat_vitalidade or 0, item.stat_atk or 0,
                       item.stat_destreza or 0, item.stat_magia or 0)
        stat_key = (
            "vitalidade" if (item.stat_vitalidade or 0) == stat_val else
            "atk"        if (item.stat_atk        or 0) == stat_val else
            "destreza"   if (item.stat_destreza   or 0) == stat_val else "magia"
        )
        base["label"] = f"{re} {item.item_name or item.item_slot} (+{stat_val} {stat_key})"
        base["icon"]  = "⚔"
    else:
        labels = {
            "vitality":      f"+{int(item.value or 0)} days",
            "token_boost":   f"+{int(item.value or 0)}% tokens",
            "drop_boost":    f"+{round((item.value or 0) * 100, 4)}% drop/min",
            "upgrade_stone": "Upgrade Stone",
        }
        icons = {"vitality": "💚", "token_boost": "⚡", "drop_boost": "🍀", "upgrade_stone": "🪨"}
        base["label"] = labels.get(item.item_type, "?")
        base["icon"]  = icons.get(item.item_type, "📦")

    return base
