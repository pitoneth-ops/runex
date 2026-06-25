from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime, timezone

Base = declarative_base()


class Transaction(Base):
    __tablename__ = "transactions"
    id          = Column(Integer, primary_key=True, index=True)
    player_id   = Column(Integer, ForeignKey("players.id"), index=True)
    tx_type     = Column(String)   # char_mint | hero_mint | item_drop | miner_upgrade | battle_royale | chest
    description = Column(Text)
    value       = Column(Integer, default=0)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Player(Base):
    __tablename__ = "players"
    id         = Column(Integer, primary_key=True, index=True)
    wallet     = Column(String, unique=True, index=True)
    tokens     = Column(Integer, default=0)   # Gold (GP) earned from staking
    runex      = Column(Integer, default=0)   # on-chain RuneX balance (synced from wallet on login)
    wrunex     = Column(Integer, default=0)   # in-game wRuneX earned from battles/chests (withdrawable)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Skills — stored as float; level = floor(value), progress = value % 1
    # 1 staked-character-day = 1 level. Cap 99.
    skill_attack    = Column(Float, default=1.0)   # warrior days
    skill_ranged    = Column(Float, default=1.0)   # archer days
    skill_magic     = Column(Float, default=1.0)   # mage days
    skill_mining    = Column(Float, default=1.0)   # miner days
    skill_hitpoints = Column(Float, default=10.0)  # all classes

    characters  = relationship("Character", back_populates="player", cascade="all, delete-orphan")
    items       = relationship("Item", back_populates="player", cascade="all, delete-orphan")
    heroes      = relationship("HeroX", back_populates="player", cascade="all, delete-orphan")
    battle_wins             = Column(Integer,  default=0)
    staked_gold             = Column(Integer,  default=0)
    staked_gold_until       = Column(DateTime, nullable=True)
    starter_miner_claimed   = Column(Boolean,  default=False)


class Character(Base):
    __tablename__ = "characters"
    id            = Column(Integer, primary_key=True, index=True)
    player_id     = Column(Integer, ForeignKey("players.id"), index=True)
    class_type    = Column(String)    # archer | warrior | mage | miner
    rarity        = Column(String)    # common | rare | epic | legendary
    name          = Column(String, default="")
    expires_at    = Column(DateTime)
    is_staked     = Column(Boolean, default=False)
    staked_at     = Column(DateTime, nullable=True)
    last_claim_at = Column(DateTime, nullable=True)
    last_chest_at = Column(DateTime, nullable=True)
    obtained_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    is_starter = Column(Boolean, default=False)  # free trial miner — 100 gp/day, no box drop

    # Combat stats — generated on creation, permanent
    stat_attack  = Column(Integer, default=0)
    stat_defense = Column(Integer, default=0)
    stat_hp      = Column(Integer, default=0)
    stat_magic   = Column(Integer, default=0)
    stat_ranged  = Column(Integer, default=0)
    stat_speed   = Column(Integer, default=0)

    player = relationship("Player", back_populates="characters")
    items  = relationship("Item", foreign_keys="Item.equipped_on", back_populates="character")


class HeroX(Base):
    """Combat heroes — max 3 per account, earn RuneX in daily battles."""
    __tablename__ = "heroes"
    id          = Column(Integer, primary_key=True, index=True)
    player_id   = Column(Integer, ForeignKey("players.id"), index=True)
    hero_class  = Column(String)   # berserker | ranger | sorcerer | paladin
    rarity      = Column(String)   # common | rare | epic | legendary

    stat_attack  = Column(Integer, default=0)
    stat_defense = Column(Integer, default=0)
    stat_hp      = Column(Integer, default=0)
    stat_magic   = Column(Integer, default=0)
    stat_ranged  = Column(Integer, default=0)
    stat_speed   = Column(Integer, default=0)

    last_battle_date    = Column(String,  nullable=True)  # YYYY-MM-DD UTC
    best_phase          = Column(Integer, default=0)
    total_runex_earned  = Column(Integer, default=0)
    obtained_at         = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    player = relationship("Player", back_populates="heroes")
    items  = relationship("Item", foreign_keys="Item.hero_equipped_on", back_populates="hero")


class Item(Base):
    __tablename__ = "items"
    id          = Column(Integer, primary_key=True, index=True)
    player_id   = Column(Integer, ForeignKey("players.id"), index=True)
    item_type   = Column(String)   # vitality | token_boost | drop_boost | equipment
    value       = Column(Float)
    is_equipped = Column(Boolean, default=False)
    equipped_on = Column(Integer, ForeignKey("characters.id"), nullable=True)
    obtained_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    hero_equipped_on = Column(Integer, ForeignKey("heroes.id"), nullable=True)

    # Equipment system (HeroX only)
    item_slot       = Column(String,  nullable=True)   # head|neck|cape|weapon|body|shield|legs|hands|feet|ring
    item_rarity     = Column(String,  nullable=True)   # common|rare|epic|legendary
    item_name       = Column(String,  nullable=True)   # display name
    stat_vitalidade = Column(Integer, default=0)
    stat_atk        = Column(Integer, default=0)
    stat_destreza   = Column(Integer, default=0)
    stat_magia      = Column(Integer, default=0)

    player    = relationship("Player",    back_populates="items")
    character = relationship("Character", foreign_keys=[equipped_on],      back_populates="items")
    hero      = relationship("HeroX",     foreign_keys=[hero_equipped_on], back_populates="items")
