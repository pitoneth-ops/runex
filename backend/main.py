from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import os

from models import Base, Player, Character, Item
from game_logic import (
    open_box, stake, unstake, claim,
    equip_item, unequip_item,
    char_to_dict, item_to_dict,
)
from character_data import EXPIRY_DAYS, BOX_COST, CLASS_EMOJI, RARITY_EMOJI

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./rpgame.db")
engine       = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

app = FastAPI(title="RPGame API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_tables():
    Base.metadata.create_all(bind=engine)

create_tables()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_player(wallet: str, db: Session) -> Player:
    p = db.query(Player).filter(Player.wallet == wallet).first()
    if not p:
        raise HTTPException(404, "player not found")
    return p


def _get_char(char_id: int, player: Player, db: Session) -> Character:
    char = db.query(Character).filter(Character.id == char_id, Character.player_id == player.id).first()
    if not char:
        raise HTTPException(404, "character not found")
    return char


def _get_item(item_id: int, player: Player, db: Session) -> Item:
    item = db.query(Item).filter(Item.id == item_id, Item.player_id == player.id).first()
    if not item:
        raise HTTPException(404, "item not found")
    return item


# ── Bodies ────────────────────────────────────────────────────────────────────

class WalletBody(BaseModel):
    wallet: str

class EquipBody(BaseModel):
    item_id: int

class UnequipBody(BaseModel):
    item_id: int


# ── Player ────────────────────────────────────────────────────────────────────

@app.post("/player/login")
def login(body: WalletBody, db: Session = Depends(get_db)):
    p = db.query(Player).filter(Player.wallet == body.wallet).first()
    if not p:
        p = Player(wallet=body.wallet, tokens=BOX_COST * 3)  # starter tokens
        db.add(p)
        db.commit()
        db.refresh(p)
    chars = db.query(Character).filter(Character.player_id == p.id).all()
    return {
        "wallet": p.wallet,
        "tokens": p.tokens,
        "character_count": len(chars),
    }


@app.get("/player/{wallet}")
def get_player(wallet: str, db: Session = Depends(get_db)):
    p     = _get_player(wallet, db)
    chars = db.query(Character).filter(Character.player_id == p.id).all()
    items = db.query(Item).filter(Item.player_id == p.id, Item.is_equipped == False).all()
    return {
        "wallet":           p.wallet,
        "tokens":           p.tokens,
        "characters":       [char_to_dict(c) for c in chars],
        "inventory":        [item_to_dict(i) for i in items],
        "character_count":  len(chars),
    }


# ── Box ───────────────────────────────────────────────────────────────────────

@app.post("/player/{wallet}/box/open")
def open_box_endpoint(wallet: str, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    result = open_box(player)
    if "error" in result:
        raise HTTPException(400, result["error"])

    now        = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=result["expires_days"])

    char = Character(
        player_id  = player.id,
        class_type = result["class_type"],
        rarity     = result["rarity"],
        expires_at = expires_at,
        obtained_at= now,
    )
    db.add(char)
    db.commit()
    db.refresh(char)

    return {
        "ok":        True,
        "character": char_to_dict(char),
        "tokens":    player.tokens,
    }


# ── Staking ───────────────────────────────────────────────────────────────────

@app.post("/player/{wallet}/characters/{char_id}/stake")
def stake_endpoint(wallet: str, char_id: int, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    char   = _get_char(char_id, player, db)
    result = stake(player, char)
    if "error" in result:
        raise HTTPException(400, result["error"])
    db.commit()
    return {"ok": True, "character": char_to_dict(char)}


@app.post("/player/{wallet}/characters/{char_id}/unstake")
def unstake_endpoint(wallet: str, char_id: int, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    char   = _get_char(char_id, player, db)
    result = unstake(player, char)
    if "error" in result:
        raise HTTPException(400, result["error"])

    # Save dropped items to DB
    new_items = []
    for item_data in result.get("items_dropped", []):
        item = Item(
            player_id = player.id,
            item_type = item_data["type"],
            value     = item_data["value"],
        )
        db.add(item)
        db.flush()
        new_items.append(item_to_dict(item))

    db.commit()
    return {
        "ok":            True,
        "tokens_claimed": result["tokens_claimed"],
        "items_dropped": new_items,
        "tokens":        player.tokens,
        "character":     char_to_dict(char),
    }


@app.post("/player/{wallet}/characters/{char_id}/claim")
def claim_endpoint(wallet: str, char_id: int, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    char   = _get_char(char_id, player, db)
    result = claim(player, char)
    if "error" in result:
        raise HTTPException(400, result["error"])

    new_items = []
    for item_data in result.get("items_dropped", []):
        item = Item(
            player_id = player.id,
            item_type = item_data["type"],
            value     = item_data["value"],
        )
        db.add(item)
        db.flush()
        new_items.append(item_to_dict(item))

    expired = result.get("expired", False)
    if expired:
        db.delete(char)

    db.commit()
    return {
        "ok":            True,
        "tokens_claimed": result["tokens_claimed"],
        "items_dropped": new_items,
        "tokens":        player.tokens,
        "expired":       expired,
    }


# ── Items ─────────────────────────────────────────────────────────────────────

@app.post("/player/{wallet}/characters/{char_id}/equip")
def equip_endpoint(wallet: str, char_id: int, body: EquipBody, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    char   = _get_char(char_id, player, db)
    item   = _get_item(body.item_id, player, db)
    result = equip_item(player, char, item)
    if "error" in result:
        raise HTTPException(400, result["error"])
    db.commit()
    return {"ok": True, "character": char_to_dict(char)}


@app.post("/player/{wallet}/characters/{char_id}/unequip")
def unequip_endpoint(wallet: str, char_id: int, body: UnequipBody, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    char   = _get_char(char_id, player, db)
    item   = _get_item(body.item_id, player, db)
    result = unequip_item(player, char, item)
    if "error" in result:
        raise HTTPException(400, result["error"])
    db.commit()
    return {"ok": True, "character": char_to_dict(char)}


@app.get("/player/{wallet}/inventory")
def get_inventory(wallet: str, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    items  = db.query(Item).filter(Item.player_id == player.id).all()
    return [item_to_dict(i) for i in items]


# ── Info ──────────────────────────────────────────────────────────────────────

@app.get("/info")
def game_info():
    return {
        "box_cost":   BOX_COST,
        "expiry_days": EXPIRY_DAYS,
        "chest_drop_per_min": 0.003,
    }
