from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime, timezone

Base = declarative_base()


class Player(Base):
    __tablename__ = "players"
    id         = Column(Integer, primary_key=True, index=True)
    wallet     = Column(String, unique=True, index=True)
    tokens     = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    characters = relationship("Character", back_populates="player", cascade="all, delete-orphan")
    items      = relationship("Item", back_populates="player", cascade="all, delete-orphan")


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

    player = relationship("Player", back_populates="characters")
    items  = relationship("Item", foreign_keys="Item.equipped_on", back_populates="character")


class Item(Base):
    __tablename__ = "items"
    id          = Column(Integer, primary_key=True, index=True)
    player_id   = Column(Integer, ForeignKey("players.id"), index=True)
    item_type   = Column(String)   # vitality | token_boost | drop_boost
    value       = Column(Float)
    is_equipped = Column(Boolean, default=False)
    equipped_on = Column(Integer, ForeignKey("characters.id"), nullable=True)
    obtained_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    player    = relationship("Player", back_populates="items")
    character = relationship("Character", foreign_keys=[equipped_on], back_populates="items")
