from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import os

# Solana signature verification
try:
    from nacl.signing import VerifyKey
    from nacl.exceptions import BadSignatureError
    import base58 as _base58
    _HAS_NACL = True
except ImportError:
    _HAS_NACL = False

from models import Base, Player, Character, Item, HeroX, Transaction
from game_logic import (
    open_box, stake, unstake, claim,
    equip_item, unequip_item,
    char_to_dict, item_to_dict,
)
from character_data import EXPIRY_DAYS, BOX_COST, CLASS_EMOJI, RARITY_EMOJI, roll_stats
from hero_data import (
    roll_hero_class, roll_hero_rarity, roll_hero_stats,
    HERO_MINT_COST, MAX_HEROES, HERO_PRIMARY, HERO_RARITY_EMOJI,
    PHASE_RUNEX_INCREMENT, today_utc,
    roll_equipment_item, PHASE_EQUIP_DROP,
)
import random
import requests as _requests

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./rpgame.db")
# Railway uses legacy postgres:// prefix — SQLAlchemy requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+pg8000://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+pg8000://", 1)
_is_sqlite   = "sqlite" in DATABASE_URL
engine       = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    # SQLite: serialise writes so claim race conditions can't double-credit Gold
    isolation_level="SERIALIZABLE" if _is_sqlite else None,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

app = FastAPI(title="RPGame API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── On-chain RuneX ────────────────────────────────────────────────────────────
_RUNEX_MINT      = "6AVAUKa9uxQpruHZUinFECpXEh1usRVtzQWK8N2wpump"
_TREASURY_WALLET = "2yeGpBaCFF8Q4jNFEmncL677wxjKaDHFnr7v5YGVX2T6"
_SOLANA_RPC      = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")


def _get_on_chain_runex(wallet: str) -> int:
    """Return wallet's on-chain RuneX balance as a whole-unit integer. -1 on failure."""
    try:
        resp = _requests.post(_SOLANA_RPC, json={
            "jsonrpc": "2.0", "id": 1,
            "method": "getTokenAccountsByOwner",
            "params": [wallet, {"mint": _RUNEX_MINT}, {"encoding": "jsonParsed"}],
        }, timeout=5)
        accounts = resp.json().get("result", {}).get("value", [])
        if not accounts:
            return 0
        ui = accounts[0]["account"]["data"]["parsed"]["info"]["tokenAmount"]["uiAmount"]
        return int(ui or 0)
    except Exception:
        return -1


def _sync_runex(player: Player, db: Session) -> None:
    """Called only on auth — syncs on-chain balance to DB."""
    bal = _get_on_chain_runex(player.wallet)
    if bal >= 0 and bal != (player.runex or 0):
        player.runex = bal
        db.commit()


def _verify_runex_tx(from_wallet: str, signature: str, min_ui: float) -> bool:
    """
    Verify that `signature` is a confirmed on-chain tx where the treasury wallet
    received at least `min_ui` whole units of RuneX. Retries up to 6x with 3s delay
    to handle RPC indexing lag after confirmation.
    """
    import time
    for attempt in range(6):
        try:
            resp = _requests.post(_SOLANA_RPC, json={
                "jsonrpc": "2.0", "id": 1,
                "method": "getTransaction",
                "params": [signature, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}],
            }, timeout=10)
            tx = resp.json().get("result")
            if tx is None:
                time.sleep(3)
                continue
            if (tx.get("meta") or {}).get("err"):
                return False  # tx failed on-chain — no point retrying

            pre  = {b["accountIndex"]: b for b in tx["meta"].get("preTokenBalances",  [])}
            post = {b["accountIndex"]: b for b in tx["meta"].get("postTokenBalances", [])}

            for idx, pb in post.items():
                if pb.get("mint") != _RUNEX_MINT:
                    continue
                if pb.get("owner") != _TREASURY_WALLET:
                    continue
                pre_ui  = float((pre.get(idx) or {}).get("uiTokenAmount", {}).get("uiAmount") or 0)
                post_ui = float(pb["uiTokenAmount"].get("uiAmount") or 0)
                if post_ui - pre_ui >= min_ui:
                    return True
            return False
        except Exception:
            time.sleep(3)
    return False


def _tx_already_used(signature: str, db: Session) -> bool:
    return db.query(Transaction).filter(
        Transaction.description == f"tx:{signature}"
    ).first() is not None


def _send_runex_from_treasury(to_wallet: str, ui_amount: float) -> str:
    """
    Build, sign, and send a Token-2022 TransferChecked from the treasury ATA to
    `to_wallet`'s ATA. Returns the on-chain tx signature.

    Treasury private key comes from TREASURY_PRIVATE_KEY env var — a base58-encoded
    Solana keypair (64 bytes: seed + pubkey) or just the 32-byte seed.
    """
    import struct, hashlib, base64
    from nacl.signing import SigningKey as _SigningKey

    sk_b58 = os.getenv("TREASURY_PRIVATE_KEY", "")
    if not sk_b58:
        raise ValueError("TREASURY_PRIVATE_KEY not configured")

    raw_key = _base58.b58decode(sk_b58)
    seed    = raw_key[:32]  # Solana keypair = seed(32) + pubkey(32); we only need seed
    signer  = _SigningKey(seed)
    treasury_pk = bytes(signer.verify_key)

    # Safety: confirm derived pubkey matches the expected treasury address
    if _base58.b58encode(treasury_pk).decode() != _TREASURY_WALLET:
        raise ValueError("TREASURY_PRIVATE_KEY does not match the treasury wallet — double-check the key")

    # Program IDs
    TOKEN_2022  = _base58.b58decode("TokenzQdBNbLqP5VEhdkAS6EPULC3gwQ2Wr6ziJCq5b")
    ASSOC_TOKEN = _base58.b58decode("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bSe")
    SYSTEM_PROG = bytes(32)

    mint_pk   = _base58.b58decode(_RUNEX_MINT)
    player_pk = _base58.b58decode(to_wallet)
    raw_amt   = int(round(ui_amount * 10 ** 6))  # RuneX has 6 decimals

    def _find_ata(wallet: bytes, mint: bytes) -> bytes:
        """Derive Token-2022 Associated Token Account via find_program_address."""
        prefix = wallet + TOKEN_2022 + mint
        for nonce in range(255, -1, -1):
            candidate = hashlib.sha256(prefix + bytes([nonce]) + ASSOC_TOKEN + b"ProgramDerivedAddress").digest()
            try:
                VerifyKey(candidate)  # succeeds → on Ed25519 curve → not a valid PDA
            except Exception:
                return candidate      # off-curve → valid PDA
        raise ValueError("ATA derivation failed")

    source_ata = _find_ata(treasury_pk, mint_pk)
    dest_ata   = _find_ata(player_pk,   mint_pk)

    def _cu16(n: int) -> bytes:
        """Solana compact-u16."""
        if n <= 0x7f:
            return bytes([n])
        elif n <= 0x3fff:
            return bytes([(n & 0x7f) | 0x80, (n >> 7) & 0x7f])
        return bytes([(n & 0x7f) | 0x80, ((n >> 7) & 0x7f) | 0x80, (n >> 14) & 0x03])

    # Accounts (ordered: writable+signed, writable+unsigned, readonly+unsigned)
    # 0: treasury    — signer, writable
    # 1: source_ata  — writable (treasury's RuneX ATA)
    # 2: dest_ata    — writable (player's RuneX ATA)
    # 3: player_pk   — readonly (ATA owner, needed by ASSOC_TOKEN_PROG)
    # 4: mint_pk     — readonly
    # 5: SYSTEM_PROG — readonly
    # 6: TOKEN_2022  — readonly (transfer program)
    # 7: ASSOC_TOKEN — readonly (ATA create program)
    accounts = [treasury_pk, source_ata, dest_ata, player_pk, mint_pk, SYSTEM_PROG, TOKEN_2022, ASSOC_TOKEN]
    header   = bytes([1, 0, 5])  # 1 signer, 0 readonly-signers, 5 readonly-unsigned

    bh_resp = _requests.post(_SOLANA_RPC, json={
        "jsonrpc": "2.0", "id": 1,
        "method": "getLatestBlockhash",
        "params": [{"commitment": "confirmed"}],
    }, timeout=10).json()
    blockhash = _base58.b58decode(bh_resp["result"]["value"]["blockhash"])

    # Instruction 1 — CreateAssociatedTokenAccountIdempotent
    #   Program idx 7; accounts: funder=0, ata=2, owner=3, mint=4, system=5, token_prog=6
    #   Data: [1] = CreateIdempotent discriminator
    ix_create = bytes([7]) + _cu16(6) + bytes([0, 2, 3, 4, 5, 6]) + _cu16(1) + bytes([1])

    # Instruction 2 — TransferChecked (Token-2022)
    #   Program idx 6; accounts: src=1, mint=4, dst=2, authority=0
    #   Data: [12] + u64(amount_raw) + u8(decimals)
    transfer_data = bytes([12]) + struct.pack("<Q", raw_amt) + bytes([6])
    ix_transfer   = bytes([6]) + _cu16(4) + bytes([1, 4, 2, 0]) + _cu16(len(transfer_data)) + transfer_data

    message = (
        header
        + _cu16(len(accounts)) + b"".join(accounts)
        + blockhash
        + _cu16(2) + ix_create + ix_transfer
    )

    sig      = bytes(signer.sign(message).signature)
    tx_bytes = _cu16(1) + sig + message  # 1 signature

    send_resp = _requests.post(_SOLANA_RPC, json={
        "jsonrpc": "2.0", "id": 1,
        "method": "sendTransaction",
        "params": [base64.b64encode(tx_bytes).decode(), {"encoding": "base64", "maxRetries": 5}],
    }, timeout=15).json()

    if "error" in send_resp:
        raise ValueError(f"RPC error: {send_resp['error'].get('message', send_resp['error'])}")
    return send_resp["result"]


def _migrate(stmt: str):
    """Run a single DDL statement in its own connection so a failure never aborts other migrations."""
    try:
        with engine.connect() as c:
            c.execute(text(stmt))
            c.commit()
    except Exception:
        pass


def create_tables():
    Base.metadata.create_all(bind=engine)
    # Add columns to existing DBs without recreating tables.
    # Each migration uses its own connection — a PostgreSQL failure in one
    # aborts only that transaction and never blocks the ones that follow.
    for col, typ, default in [
        ("skill_attack",      "REAL",    1.0),
        ("skill_ranged",      "REAL",    1.0),
        ("skill_magic",       "REAL",    1.0),
        ("skill_mining",      "REAL",    1.0),
        ("skill_hitpoints",   "REAL",    1.0),
        ("battle_wins",       "INTEGER", 0),
        ("runex",             "INTEGER", 0),
        ("staked_gold",       "INTEGER", 0),
        ("staked_gold_until", "TEXT",    "NULL"),
        ("starter_miner_claimed", "BOOLEAN", "FALSE"),
    ]:
        _migrate(f"ALTER TABLE players ADD COLUMN {col} {typ} DEFAULT {default}")

    for col, typ, default in [
        ("stat_attack",  "INTEGER", 0),
        ("stat_defense", "INTEGER", 0),
        ("stat_hp",      "INTEGER", 0),
        ("stat_magic",   "INTEGER", 0),
        ("stat_ranged",  "INTEGER", 0),
        ("stat_speed",   "INTEGER", 0),
        ("is_starter",   "BOOLEAN", "FALSE"),
    ]:
        _migrate(f"ALTER TABLE characters ADD COLUMN {col} {typ} DEFAULT {default}")

    for col, typ, default in [
        ("stat_attack",         "INTEGER", 0),
        ("stat_defense",        "INTEGER", 0),
        ("stat_hp",             "INTEGER", 0),
        ("stat_magic",          "INTEGER", 0),
        ("stat_ranged",         "INTEGER", 0),
        ("stat_speed",          "INTEGER", 0),
        ("last_battle_date",    "TEXT",    "NULL"),
        ("best_phase",          "INTEGER", 0),
        ("total_runex_earned",  "INTEGER", 0),
    ]:
        _migrate(f"ALTER TABLE heroes ADD COLUMN {col} {typ} DEFAULT {default}")

    _migrate("ALTER TABLE items ADD COLUMN hero_equipped_on INTEGER REFERENCES heroes(id)")

    for col, typ, default in [
        ("item_slot",       "TEXT",    "NULL"),
        ("item_rarity",     "TEXT",    "NULL"),
        ("item_name",       "TEXT",    "NULL"),
        ("stat_vitalidade", "INTEGER", 0),
        ("stat_atk",        "INTEGER", 0),
        ("stat_destreza",   "INTEGER", 0),
        ("stat_magia",      "INTEGER", 0),
    ]:
        _migrate(f"ALTER TABLE items ADD COLUMN {col} {typ} DEFAULT {default}")

    # Backfill stats for characters that don't have them yet
    _backfill_char_stats()


def _backfill_char_stats():
    db = SessionLocal()
    try:
        chars = db.query(Character).filter(Character.stat_attack == 0).all()
        for char in chars:
            s = roll_stats(char.class_type, char.rarity)
            char.stat_attack  = s["attack"]
            char.stat_defense = s["defense"]
            char.stat_hp      = s["hp"]
            char.stat_magic   = s["magic"]
            char.stat_ranged  = s["ranged"]
            char.stat_speed   = s["speed"]
        if chars:
            db.commit()
    finally:
        db.close()


create_tables()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Solana auth ───────────────────────────────────────────────────────────────

_AUTH_WINDOW_MS = 5 * 60 * 1000  # 5 minutes


def _verify_solana_sig(wallet: str, message: str, sig_hex: str) -> bool:
    """Verify an ed25519 signature produced by Phantom/Solflare signMessage."""
    if not _HAS_NACL:
        return False
    try:
        pubkey_bytes = _base58.b58decode(wallet)
        sig_bytes    = bytes.fromhex(sig_hex)
        msg_bytes    = message.encode("utf-8")
        VerifyKey(pubkey_bytes).verify(msg_bytes, sig_bytes)
        return True
    except (BadSignatureError, Exception):
        return False


class AuthBody(BaseModel):
    wallet:    str
    signature: str   # hex-encoded ed25519 signature
    message:   str   # the exact UTF-8 string that was signed


@app.post("/player/auth")
def auth_wallet(body: AuthBody, db: Session = Depends(get_db)):
    """Authenticate with a Solana wallet by verifying a signed message."""
    # 1. Parse timestamp from message and reject stale requests
    try:
        ts_line = next(l for l in body.message.splitlines() if l.startswith("Timestamp:"))
        ts_ms   = int(ts_line.split(":", 1)[1].strip())
        now_ms  = int(datetime.now(timezone.utc).timestamp() * 1000)
        if abs(now_ms - ts_ms) > _AUTH_WINDOW_MS:
            raise HTTPException(401, "Auth message expired — refresh and try again")
    except (StopIteration, ValueError):
        raise HTTPException(400, "Invalid auth message format")

    # 2. Verify ed25519 signature (wallet owns the private key)
    if not _verify_solana_sig(body.wallet, body.message, body.signature):
        raise HTTPException(401, "Signature invalid")

    # 3. Create player on first login, sync on-chain RuneX, return full state
    p = db.query(Player).filter(Player.wallet == body.wallet).first()
    if not p:
        p = Player(wallet=body.wallet, tokens=0)
        db.add(p)
        db.commit()
        db.refresh(p)

    _sync_runex(p, db)
    return get_player(body.wallet, db)


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


def _make_item(player_id: int, data: dict) -> Item:
    """Create an Item ORM object from a roll_item() or roll_equipment_item() dict."""
    if data.get("item_type") == "equipment":
        return Item(
            player_id       = player_id,
            item_type       = "equipment",
            value           = data.get("value", 0),
            item_slot       = data.get("item_slot"),
            item_rarity     = data.get("item_rarity"),
            item_name       = data.get("item_name"),
            stat_vitalidade = data.get("stat_vitalidade", 0),
            stat_atk        = data.get("stat_atk",        0),
            stat_destreza   = data.get("stat_destreza",   0),
            stat_magia      = data.get("stat_magia",       0),
        )
    else:
        return Item(
            player_id = player_id,
            item_type = data.get("type") or data.get("item_type", "vitality"),
            value     = data.get("value", 0),
        )


# ── Skill Capes ───────────────────────────────────────────────────────────────

SKILL_CAPES = {
    "attack":    {"name": "Attack Cape",    "stat_atk": 12, "stat_destreza": 0,  "stat_magia": 0,  "stat_vitalidade": 3},
    "ranged":    {"name": "Ranged Cape",    "stat_atk": 0,  "stat_destreza": 12, "stat_magia": 0,  "stat_vitalidade": 3},
    "magic":     {"name": "Magic Cape",     "stat_atk": 0,  "stat_destreza": 0,  "stat_magia": 12, "stat_vitalidade": 3},
    "mining":    {"name": "Mining Cape",    "stat_atk": 3,  "stat_destreza": 0,  "stat_magia": 0,  "stat_vitalidade": 10},
    "hitpoints": {"name": "Hitpoints Cape", "stat_atk": 3,  "stat_destreza": 0,  "stat_magia": 0,  "stat_vitalidade": 18},
}

SKILL_PLAYER_ATTRS = {
    "attack":    "skill_attack",
    "ranged":    "skill_ranged",
    "magic":     "skill_magic",
    "mining":    "skill_mining",
    "hitpoints": "skill_hitpoints",
}


def _award_skill_capes(player: Player, db: Session) -> list:
    owned = {
        i.item_name
        for i in db.query(Item).filter(Item.player_id == player.id, Item.item_slot == "cape").all()
        if i.item_name and i.item_name.endswith(" Cape")
    }
    awarded = []
    for skill_key, attr in SKILL_PLAYER_ATTRS.items():
        val = getattr(player, attr, None) or 0.0
        if val >= 99.0:
            cape = SKILL_CAPES[skill_key]
            if cape["name"] not in owned:
                item = _make_item(player.id, {
                    "item_type":      "equipment",
                    "item_slot":      "cape",
                    "item_rarity":    "legendary",
                    "item_name":      cape["name"],
                    "value":          15.0,
                    "stat_atk":       cape["stat_atk"],
                    "stat_destreza":  cape["stat_destreza"],
                    "stat_magia":     cape["stat_magia"],
                    "stat_vitalidade":cape["stat_vitalidade"],
                })
                db.add(item)
                db.flush()
                awarded.append(item_to_dict(item))
                owned.add(cape["name"])
    return awarded


def _bank_boost_pct(player) -> int:
    """Return the bank staking GP boost as an integer percentage (0–100)."""
    return min(int((player.staked_gold or 0) // 1_000_000) * 10, 100)


_CLASS_SKILL_ATTR = {
    "warrior": "skill_attack", "archer": "skill_ranged",
    "mage": "skill_magic", "miner": "skill_mining",
}


def _skill_bonus_pct(player: Player, class_type: str) -> float:
    """Return +0.2% per skill level for matching class."""
    attr = _CLASS_SKILL_ATTR.get(class_type, "")
    if not attr:
        return 0.0
    return int(getattr(player, attr, 1.0) or 1.0) * 0.2


def _log_tx(player_id: int, tx_type: str, description: str, value: int, db: Session):
    db.add(Transaction(player_id=player_id, tx_type=tx_type, description=description, value=value))


def hero_to_dict(h: HeroX) -> dict:
    today = today_utc()
    return {
        "id":                  h.id,
        "hero_class":          h.hero_class,
        "rarity":              h.rarity,
        "rarity_emoji":        HERO_RARITY_EMOJI.get(h.rarity, ""),
        "primary_stat":        HERO_PRIMARY.get(h.hero_class, "attack"),
        "stats": {
            "attack":  h.stat_attack  or 0,
            "defense": h.stat_defense or 0,
            "hp":      h.stat_hp      or 0,
            "magic":   h.stat_magic   or 0,
            "ranged":  h.stat_ranged  or 0,
            "speed":   h.stat_speed   or 0,
        },
        "last_battle_date":   h.last_battle_date,
        "can_battle":         (h.last_battle_date != today),
        "best_phase":         h.best_phase or 0,
        "total_runex_earned": h.total_runex_earned or 0,
        "hero_level":         min(50, int((h.total_runex_earned or 0) / 10_000)),
        "obtained_at":        h.obtained_at.isoformat() if h.obtained_at else None,
        "equipped_items":     [item_to_dict(i) for i in (h.items or []) if i.is_equipped],
    }


# ── Bodies ────────────────────────────────────────────────────────────────────

class WalletBody(BaseModel):
    wallet: str

class EquipBody(BaseModel):
    item_id: int

class UnequipBody(BaseModel):
    item_id: int

class ClassGroupBody(BaseModel):
    class_group: str  # "fighter" or "miner"

class StakeGoldBody(BaseModel):
    amount: int


# ── Player ────────────────────────────────────────────────────────────────────

@app.post("/player/login")
def login(body: WalletBody, db: Session = Depends(get_db)):
    p = db.query(Player).filter(Player.wallet == body.wallet).first()
    if not p:
        p = Player(wallet=body.wallet, tokens=0)  # starter tokens
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

    now = datetime.now(timezone.utc)
    def _pending_days(c: Character) -> float:
        if not c.is_staked:
            return 0.0
        ref = c.last_claim_at or c.staked_at
        if ref is None:
            return 0.0
        if ref.tzinfo is None:
            ref = ref.replace(tzinfo=timezone.utc)
        return max(0.0, (now - ref).total_seconds()) / 86400.0

    staked = [c for c in chars if c.is_staked]
    pending_skills = {
        "attack":    round(sum(_pending_days(c) for c in staked if c.class_type == "warrior"), 4),
        "ranged":    round(sum(_pending_days(c) for c in staked if c.class_type == "archer"),  4),
        "magic":     round(sum(_pending_days(c) for c in staked if c.class_type == "mage"),    4),
        "mining":    round(sum(_pending_days(c) for c in staked if c.class_type == "miner"),   4),
        "hitpoints": round(sum(_pending_days(c) for c in staked),                              4),
    }

    heroes = db.query(HeroX).filter(HeroX.player_id == p.id).all()

    # Auto-award any skill capes the player has earned
    new_capes = _award_skill_capes(p, db)
    if new_capes:
        db.commit()
        items = db.query(Item).filter(Item.player_id == p.id, Item.is_equipped == False).all()

    staked_until = p.staked_gold_until
    if staked_until is not None and staked_until.tzinfo is None:
        staked_until = staked_until.replace(tzinfo=timezone.utc)

    bank_boost = _bank_boost_pct(p)
    return {
        "wallet":          p.wallet,
        "tokens":          p.tokens,
        "runex":           p.runex or 0,
        "characters":      [char_to_dict(c, bank_boost_pct=bank_boost, skill_bonus_pct=_skill_bonus_pct(p, c.class_type)) for c in chars],
        "inventory":       [item_to_dict(i) for i in items],
        "heroes":          [hero_to_dict(h) for h in heroes],
        "character_count": len(chars),
        "skills": {
            "attack":    p.skill_attack    or 1.0,
            "ranged":    p.skill_ranged    or 1.0,
            "magic":     p.skill_magic     or 1.0,
            "mining":    p.skill_mining    or 1.0,
            "hitpoints": p.skill_hitpoints or 1.0,
        },
        "pending_skills": pending_skills,
        "staked_gold":              p.staked_gold or 0,
        "staked_gold_until":        staked_until.isoformat() if staked_until else None,
        "bank_boost_pct":           _bank_boost_pct(p),
        "starter_miner_claimed":    bool(getattr(p, "starter_miner_claimed", False)),
    }


# ── Box ───────────────────────────────────────────────────────────────────────

class OpenBoxBody(BaseModel):
    tx_signature: str


@app.post("/player/{wallet}/box/open")
def open_box_endpoint(wallet: str, body: OpenBoxBody, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)

    if _tx_already_used(body.tx_signature, db):
        raise HTTPException(400, "Transaction already used")
    if not _verify_runex_tx(player.wallet, body.tx_signature, BOX_COST_RUNEX):
        raise HTTPException(400, "RuneX transaction invalid or unconfirmed — send exactly 50,000 RuneX to the treasury first")

    now        = datetime.now(timezone.utc)
    rarity     = roll_rarity()
    class_type = roll_class()
    expires_at = now + timedelta(days=EXPIRY_DAYS[rarity])

    s = roll_stats(class_type, rarity)
    char = Character(
        player_id    = player.id,
        class_type   = class_type,
        rarity       = rarity,
        expires_at   = expires_at,
        obtained_at  = now,
        stat_attack  = s["attack"],
        stat_defense = s["defense"],
        stat_hp      = s["hp"],
        stat_magic   = s["magic"],
        stat_ranged  = s["ranged"],
        stat_speed   = s["speed"],
    )
    db.add(char)
    db.flush()
    _log_tx(player.id, "char_mint", f"tx:{body.tx_signature}", 0, db)
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
    # Lock both rows for the duration of this transaction to prevent double-claim
    player = db.query(Player).filter(Player.wallet == wallet).with_for_update().first()
    if not player:
        raise HTTPException(404, "player not found")
    char = db.query(Character).filter(
        Character.id == char_id, Character.player_id == player.id
    ).with_for_update().first()
    if not char:
        raise HTTPException(404, "character not found")
    result = unstake(player, char)
    if "error" in result:
        raise HTTPException(400, result["error"])

    # Save dropped items to DB
    new_items = []
    for item_data in result.get("items_dropped", []):
        item = _make_item(player.id, item_data)
        db.add(item)
        db.flush()
        d = item_to_dict(item)
        new_items.append(d)
        _log_tx(player.id, "item_drop", d.get("label", item.item_type), 1, db)

    capes_unlocked = _award_skill_capes(player, db)
    db.commit()
    return {
        "ok":              True,
        "tokens_claimed":  result["tokens_claimed"],
        "items_dropped":   new_items,
        "tokens":          player.tokens,
        "character":       char_to_dict(char),
        "capes_unlocked":  capes_unlocked,
    }


@app.post("/player/{wallet}/characters/{char_id}/claim")
def claim_endpoint(wallet: str, char_id: int, db: Session = Depends(get_db)):
    # Lock both rows — prevents two simultaneous requests from double-crediting Gold
    player = db.query(Player).filter(Player.wallet == wallet).with_for_update().first()
    if not player:
        raise HTTPException(404, "player not found")
    char = db.query(Character).filter(
        Character.id == char_id, Character.player_id == player.id
    ).with_for_update().first()
    if not char:
        raise HTTPException(404, "character not found")
    result = claim(player, char)
    if "error" in result:
        raise HTTPException(400, result["error"])

    new_items = []
    for item_data in result.get("items_dropped", []):
        item = _make_item(player.id, item_data)
        db.add(item)
        db.flush()
        d = item_to_dict(item)
        new_items.append(d)
        _log_tx(player.id, "item_drop", d.get("label", item.item_type), 1, db)

    expired = result.get("expired", False)
    if expired:
        db.delete(char)

    capes_unlocked = _award_skill_capes(player, db)
    db.commit()
    return {
        "ok":             True,
        "tokens_claimed": result["tokens_claimed"],
        "items_dropped":  new_items,
        "tokens":         player.tokens,
        "expired":        expired,
        "capes_unlocked": capes_unlocked,
    }


# ── Bulk stake / claim ────────────────────────────────────────────────────────

@app.post("/player/{wallet}/characters/claim-all")
def claim_all_endpoint(wallet: str, body: ClassGroupBody, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    is_miner = body.class_group == "miner"
    chars = db.query(Character).filter(
        Character.player_id == player.id,
        Character.is_staked == True,
    ).all()
    chars = [c for c in chars if (c.class_type == "miner") == is_miner]

    total_tokens = 0
    all_items: list = []
    chars_expired: list[int] = []

    for char in chars:
        result = claim(player, char)
        if "error" in result:
            continue
        total_tokens += result["tokens_claimed"]
        for item_data in result.get("items_dropped", []):
            item = _make_item(player.id, item_data)
            db.add(item)
            db.flush()
            all_items.append(item_to_dict(item))
        if result.get("expired"):
            chars_expired.append(char.id)

    for cid in chars_expired:
        c = db.query(Character).get(cid)
        if c:
            db.delete(c)

    capes_unlocked = _award_skill_capes(player, db)
    db.commit()
    return {
        "ok":             True,
        "tokens_claimed": total_tokens,
        "items_dropped":  all_items,
        "tokens":         player.tokens,
        "capes_unlocked": capes_unlocked,
    }


@app.post("/player/{wallet}/characters/stake-all")
def stake_all_endpoint(wallet: str, body: ClassGroupBody, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    is_miner = body.class_group == "miner"
    chars = db.query(Character).filter(
        Character.player_id == player.id,
        Character.is_staked == False,
    ).all()
    chars = [
        c for c in chars
        if (c.class_type == "miner") == is_miner
        and c.expires_at is not None
    ]

    staked_count = 0
    for char in chars:
        result = stake(player, char)
        if "error" not in result:
            staked_count += 1

    db.commit()
    return {"ok": True, "staked_count": staked_count}


# ── Miner Upgrade ─────────────────────────────────────────────────────────────

RARITY_UPGRADE = {
    "common":    ("rare",      1),
    "rare":      ("epic",      2),
    "epic":      ("legendary", 5),
    "legendary": (None,        0),
}


@app.post("/player/{wallet}/characters/{char_id}/upgrade")
def upgrade_miner_endpoint(wallet: str, char_id: int, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    char   = _get_char(char_id, player, db)

    if char.class_type != "miner":
        raise HTTPException(400, "Only miners can be upgraded")
    if getattr(char, "is_starter", False):
        raise HTTPException(400, "Starter miners cannot be upgraded")
    if char.is_staked:
        raise HTTPException(400, "Stop mining before upgrading")

    next_rarity, stones_needed = RARITY_UPGRADE.get(char.rarity, (None, 0))
    if next_rarity is None:
        raise HTTPException(400, "Already at max rarity (Legendary)")

    stones = db.query(Item).filter(
        Item.player_id == player.id,
        Item.item_type == "upgrade_stone",
        Item.is_equipped == False,
    ).all()

    if len(stones) < stones_needed:
        raise HTTPException(400, f"Need {stones_needed} Upgrade Stone(s), you have {len(stones)}")

    for stone in stones[:stones_needed]:
        db.delete(stone)

    char.rarity = next_rarity
    _log_tx(player.id, "miner_upgrade", f"Miner upgraded to {next_rarity} (used {stones_needed} stone{'s' if stones_needed > 1 else ''})", 0, db)
    db.commit()
    return {"ok": True, "new_rarity": next_rarity, "character": char_to_dict(char)}


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


# ── HeroX ─────────────────────────────────────────────────────────────────────

class HeroBattleBody(BaseModel):
    phases_completed: int   # 0 = died phase 1 without killing, 1 = beat phase 1, etc.


@app.post("/player/{wallet}/hero/mint")
def mint_hero(wallet: str, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    hero_count = db.query(HeroX).filter(HeroX.player_id == player.id).count()
    if hero_count >= MAX_HEROES:
        raise HTTPException(400, f"max {MAX_HEROES} heroes per account")
    if (player.tokens or 0) < HERO_MINT_COST:
        raise HTTPException(400, f"not enough gold — need {HERO_MINT_COST}")

    player.tokens -= HERO_MINT_COST
    hclass  = roll_hero_class()
    hrarity = roll_hero_rarity()
    stats   = roll_hero_stats(hclass, hrarity)

    hero = HeroX(
        player_id    = player.id,
        hero_class   = hclass,
        rarity       = hrarity,
        stat_attack  = stats["attack"],
        stat_defense = stats["defense"],
        stat_hp      = stats["hp"],
        stat_magic   = stats["magic"],
        stat_ranged  = stats["ranged"],
        stat_speed   = stats["speed"],
    )
    db.add(hero)
    db.flush()
    _log_tx(player.id, "hero_mint", f"Minted {hrarity} {hclass} HeroX", 0, db)
    db.commit()
    db.refresh(hero)
    return {"ok": True, "hero": hero_to_dict(hero), "tokens": player.tokens}


@app.delete("/player/{wallet}/hero/{hero_id}")
def burn_hero(wallet: str, hero_id: int, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    hero   = db.query(HeroX).filter(HeroX.id == hero_id, HeroX.player_id == player.id).first()
    if not hero:
        raise HTTPException(404, "hero not found")
    db.delete(hero)
    db.commit()
    return {"ok": True}


@app.post("/player/{wallet}/hero/{hero_id}/battle")
def hero_battle(wallet: str, hero_id: int, body: HeroBattleBody, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    hero   = db.query(HeroX).filter(HeroX.id == hero_id, HeroX.player_id == player.id).first()
    if not hero:
        raise HTTPException(404, "hero not found")

    today = today_utc()
    if hero.last_battle_date == today:
        raise HTTPException(400, "already battled today — resets at midnight UTC")

    phases = max(0, min(5, body.phases_completed))
    runex  = sum(PHASE_RUNEX_INCREMENT[i] for i in range(1, phases + 1))

    hero.last_battle_date   = today
    hero.best_phase         = max(hero.best_phase or 0, phases)
    hero.total_runex_earned = (hero.total_runex_earned or 0) + runex
    player.runex            = (player.runex or 0) + runex

    # Equipment drops per phase won
    dropped_items = []
    for phase in range(1, phases + 1):
        if random.random() < PHASE_EQUIP_DROP.get(phase, 0):
            idata = roll_equipment_item()
            eq    = _make_item(player.id, idata)
            db.add(eq)
            db.flush()
            d = item_to_dict(eq)
            dropped_items.append(d)
            _log_tx(player.id, "item_drop", f"[Battle] {d.get('label', 'equipment')}", 1, db)

    db.commit()
    return {
        "ok":              True,
        "phases_completed": phases,
        "runex_earned":    runex,
        "total_runex":     player.runex,
        "hero":            hero_to_dict(hero),
        "items_dropped":   dropped_items,
    }


@app.post("/player/{wallet}/hero/{hero_id}/equip")
def hero_equip(wallet: str, hero_id: int, body: EquipBody, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    hero   = db.query(HeroX).filter(HeroX.id == hero_id, HeroX.player_id == player.id).first()
    if not hero:
        raise HTTPException(404, "hero not found")
    item = _get_item(body.item_id, player, db)
    if item.is_equipped:
        raise HTTPException(400, "item is already equipped")
    if item.item_type != "equipment":
        raise HTTPException(400, "only equipment items can be equipped on heroes")

    # Auto-unequip any item already in the same slot on this hero
    if item.item_slot:
        existing = db.query(Item).filter(
            Item.hero_equipped_on == hero.id,
            Item.item_slot == item.item_slot,
            Item.is_equipped == True,
        ).first()
        if existing:
            existing.is_equipped      = False
            existing.hero_equipped_on = None

    item.is_equipped      = True
    item.hero_equipped_on = hero.id
    db.commit()
    db.refresh(hero)
    return {"ok": True, "hero": hero_to_dict(hero)}


@app.post("/player/{wallet}/hero/{hero_id}/unequip")
def hero_unequip(wallet: str, hero_id: int, body: UnequipBody, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    hero   = db.query(HeroX).filter(HeroX.id == hero_id, HeroX.player_id == player.id).first()
    if not hero:
        raise HTTPException(404, "hero not found")
    item = _get_item(body.item_id, player, db)
    if item.hero_equipped_on != hero.id:
        raise HTTPException(400, "item is not equipped on this hero")
    item.is_equipped      = False
    item.hero_equipped_on = None
    db.commit()
    return {"ok": True, "hero": hero_to_dict(hero)}


# ── Bank ─────────────────────────────────────────────────────────────────────

BANK_LOCK_DAYS = 7


@app.post("/player/{wallet}/bank/stake")
def bank_stake(wallet: str, body: StakeGoldBody, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    amount = body.amount

    if amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    if (player.tokens or 0) < amount:
        raise HTTPException(400, f"Not enough Gold — you have {player.tokens:,}")

    player.tokens       = (player.tokens or 0) - amount
    player.staked_gold  = (player.staked_gold or 0) + amount
    player.staked_gold_until = datetime.now(timezone.utc) + timedelta(days=BANK_LOCK_DAYS)

    db.commit()
    return {
        "ok":               True,
        "staked_gold":      player.staked_gold,
        "staked_gold_until": player.staked_gold_until.isoformat(),
        "tokens":           player.tokens,
        "bank_boost_pct":   _bank_boost_pct(player),
    }


@app.post("/player/{wallet}/bank/unstake")
def bank_unstake(wallet: str, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)

    if not player.staked_gold:
        raise HTTPException(400, "Nothing staked in the bank")

    now = datetime.now(timezone.utc)
    until = player.staked_gold_until
    if until is not None:
        if until.tzinfo is None:
            until = until.replace(tzinfo=timezone.utc)
        if now < until:
            remaining = until - now
            days  = remaining.days
            hours = remaining.seconds // 3600
            raise HTTPException(400, f"Gold is locked for {days}d {hours}h more")

    player.tokens           = (player.tokens or 0) + (player.staked_gold or 0)
    player.staked_gold      = 0
    player.staked_gold_until = None

    db.commit()
    return {
        "ok":     True,
        "tokens": player.tokens,
        "bank_boost_pct": 0,
    }


# ── Shop ─────────────────────────────────────────────────────────────────────

RUNEX_CHEST_COST = 5_000   # Gold to buy one RuneX chest
RUNEX_CHEST_MIN  = 1_500
RUNEX_CHEST_MAX  = 10_000

ITEM_CHEST_COST        = 8_000
ITEM_CHEST_RUNEX_MIN   = 2_500
ITEM_CHEST_RUNEX_MAX   = 5_000
ITEM_CHEST_DROP_CHANCE = 0.05        # 5% chance to drop an equipment item
ITEM_CHEST_WEIGHTS     = [88, 10, 1.5, 0.5]  # common/rare/epic/legendary — rarer than battle drops


@app.post("/player/{wallet}/shop/runex-chest")
def buy_runex_chest(wallet: str, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    if (player.tokens or 0) < RUNEX_CHEST_COST:
        raise HTTPException(400, f"Requires {RUNEX_CHEST_COST:,} Gold")

    player.tokens  = (player.tokens or 0) - RUNEX_CHEST_COST
    runex_gained   = random.randint(RUNEX_CHEST_MIN, RUNEX_CHEST_MAX)
    player.runex   = (player.runex or 0) + runex_gained

    db.commit()
    return {
        "ok":          True,
        "runex_gained": runex_gained,
        "tokens":      player.tokens,
        "runex":       player.runex,
    }


@app.post("/player/{wallet}/shop/item-chest")
def buy_item_chest(wallet: str, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    if (player.tokens or 0) < ITEM_CHEST_COST:
        raise HTTPException(400, f"Requires {ITEM_CHEST_COST:,} Gold")

    player.tokens = (player.tokens or 0) - ITEM_CHEST_COST
    runex_gained  = random.randint(ITEM_CHEST_RUNEX_MIN, ITEM_CHEST_RUNEX_MAX)
    player.runex  = (player.runex or 0) + runex_gained

    item_dropped = None
    if random.random() < ITEM_CHEST_DROP_CHANCE:
        item_data    = roll_equipment_item(weights=ITEM_CHEST_WEIGHTS)
        new_item     = _make_item(player.id, item_data)
        db.add(new_item)
        db.flush()
        item_dropped = item_to_dict(new_item)

    db.commit()
    return {
        "ok":           True,
        "runex_gained": runex_gained,
        "item_dropped": item_dropped,
        "tokens":       player.tokens,
        "runex":        player.runex,
    }


# ── Battle (legacy — kept for backward compat) ────────────────────────────────

class BattleRewardBody(BaseModel):
    tokens_won: int
    won: bool


@app.post("/player/{wallet}/battle/reward")
def battle_reward(wallet: str, body: BattleRewardBody, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    if body.won and body.tokens_won > 0:
        max_reward = 500_000
        player.tokens     += min(body.tokens_won, max_reward)
        player.battle_wins = (player.battle_wins or 0) + 1
        db.commit()
    return {"tokens": player.tokens, "battle_wins": player.battle_wins or 0}


@app.get("/player/{wallet}/inventory")
def get_inventory(wallet: str, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    items  = db.query(Item).filter(Item.player_id == player.id).all()
    return [item_to_dict(i) for i in items]


# ── Transaction History ───────────────────────────────────────────────────────

@app.get("/player/{wallet}/transactions")
def get_transactions(wallet: str, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    txs = (
        db.query(Transaction)
        .filter(Transaction.player_id == player.id)
        .order_by(Transaction.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id":          tx.id,
            "tx_type":     tx.tx_type,
            "description": tx.description,
            "value":       tx.value,
            "created_at":  tx.created_at.isoformat() if tx.created_at else None,
        }
        for tx in txs
    ]


# ── Battle Royale ─────────────────────────────────────────────────────────────

BR_ENTRY_COST   = 100_000
BR_WIN_RUNEX    = 1_000_000
BR_LEVEL_NEEDED = 10     # hero_level = total_runex_earned / 10_000

AI_NAMES = [
    "Iron Bandit", "Shadow Ranger", "Chaos Mage", "Stone Berserker",
    "Barrows Knight", "Dark Paladin", "Elvarg's Spawn", "Dragon Hunter",
    "Zamorak Zealot", "Ice Warrior", "Fire Giant", "Revenant Shade",
    "Sand Demon", "Frost Warrior", "Chaos Elemental",
]

_BR_HERO_ACTIONS = {
    "berserker": ["swings the battleaxe with bone-crushing force", "lunges forward with a battle cry", "delivers a devastating overhand strike", "charges with pure fury"],
    "ranger":    ["notches a razor-sharp arrow", "fires a rapid barrage from the shadows", "aims for the gap in the armor", "rolls and shoots on the move"],
    "sorcerer":  ["channels raw arcane energy", "launches a chain lightning bolt", "erupts in a nova of magical force", "casts a devastating hex"],
    "paladin":   ["calls upon holy light", "smites with divine fury", "heals and counterattacks instantly", "channels righteous wrath"],
}
_BR_OPP_ACTIONS = {
    "berserker": ["swings wildly", "charges with reckless abandon", "slams with brute force"],
    "ranger":    ["fires a sharp arrow", "retreats and shoots", "aims for your chest"],
    "sorcerer":  ["blasts with a fireball", "conjures a dark orb", "channels chaotic energy"],
    "paladin":   ["smites with holy power", "raises a divine shield", "presses forward relentlessly"],
}
_DEFEAT_LINES = [
    "falls to the ground!", "collapses, unable to continue!",
    "is overwhelmed and retreats!", "drops their weapon in defeat!",
]
_LOSE_LINES = [
    "finds a critical weakness!", "lands a decisive blow!",
    "overpowers with a desperate surge!", "turns the tide with raw fury!",
]
_FIGHT_STAT = {"berserker": "attack", "ranger": "ranged", "sorcerer": "magic", "paladin": "attack"}


def _br_fight(fight_num: int, p_class: str, p_stats: dict,
               o_name: str, o_class: str, o_rarity: str, o_stats: dict) -> dict:
    p_atk = p_stats[_FIGHT_STAT.get(p_class, "attack")]
    o_atk = o_stats[_FIGHT_STAT.get(o_class, "attack")]
    p_hit  = p_atk / (p_atk + o_stats["defense"] + 1)
    o_hit  = o_atk / (o_atk + p_stats["defense"] + 1)
    p_dpt  = p_hit * p_atk * 0.5
    o_dpt  = o_hit * o_atk * 0.5
    ttk    = o_stats["hp"] / max(0.01, p_dpt)
    tts    = p_stats["hp"] / max(0.01, o_dpt)
    won    = tts >= ttk
    hp_left = max(0, round(p_stats["hp"] - ttk * o_dpt)) if won else 0
    rounds  = max(2, min(6, int(min(ttk, tts))))

    p_actions = _BR_HERO_ACTIONS.get(p_class, ["attacks"])
    o_actions = _BR_OPP_ACTIONS.get(o_class, ["attacks"])
    lines: list[str] = []
    for r in range(min(rounds, 4)):
        if r % 2 == 0:
            lines.append(f"Your {p_class.capitalize()} {random.choice(p_actions)}...")
        else:
            lines.append(f"{o_name} {random.choice(o_actions)}!")
    if won:
        lines.append(f"✅ {o_name} {random.choice(_DEFEAT_LINES)} [{hp_left} HP left]")
    else:
        lines.append(f"💀 {o_name} {random.choice(_LOSE_LINES)} You are defeated!")

    return {
        "fight_number":    fight_num,
        "opponent_name":   o_name,
        "opponent_class":  o_class,
        "opponent_rarity": o_rarity,
        "won":             won,
        "hp_left":         hp_left,
        "rounds":          rounds,
        "lines":           lines,
    }


class BattleRoyaleBody(BaseModel):
    hero_id:      int
    tx_signature: str


@app.post("/player/{wallet}/claim-starter-miner")
def claim_starter_miner(wallet: str, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.wallet == wallet).with_for_update().first()
    if not player:
        raise HTTPException(404, "Player not found")
    if getattr(player, "starter_miner_claimed", False):
        raise HTTPException(400, "Starter miner already claimed on this wallet")
    if (player.runex or 0) < 1:
        raise HTTPException(400, "You need at least 1 RuneX in your wallet to claim the starter miner")

    from datetime import timezone as _tz
    expires = datetime.now(_tz.utc) + timedelta(days=30)
    stats   = roll_stats("miner", "common")
    miner   = Character(
        player_id   = player.id,
        class_type  = "miner",
        rarity      = "common",
        name        = "Starter Miner",
        expires_at  = expires,
        is_starter  = True,
        stat_attack  = stats["attack"],
        stat_defense = stats["defense"],
        stat_hp      = stats["hp"],
        stat_magic   = stats["magic"],
        stat_ranged  = stats["ranged"],
        stat_speed   = stats["speed"],
    )
    player.starter_miner_claimed = True
    db.add(miner)
    db.commit()
    db.refresh(miner)
    from game_logic import char_to_dict
    return {"ok": True, "character": char_to_dict(miner)}


@app.post("/player/{wallet}/battle-royale")
def battle_royale(wallet: str, body: BattleRoyaleBody, db: Session = Depends(get_db)):
    player = _get_player(wallet, db)
    hero   = db.query(HeroX).filter(HeroX.id == body.hero_id, HeroX.player_id == player.id).first()
    if not hero:
        raise HTTPException(404, "hero not found")

    hero_level = min(50, int((hero.total_runex_earned or 0) / 10_000))
    if hero_level < BR_LEVEL_NEEDED:
        raise HTTPException(400, f"Hero must be level {BR_LEVEL_NEEDED} ({hero.total_runex_earned:,} / 100,000 RuneX earned)")

    if _tx_already_used(body.tx_signature, db):
        raise HTTPException(400, "Transaction already used")
    if not _verify_runex_tx(player.wallet, body.tx_signature, BR_ENTRY_COST):
        raise HTTPException(400, "RuneX transaction invalid or unconfirmed — send 100,000 RuneX to the treasury first")

    _log_tx(player.id, "battle_royale", f"tx:{body.tx_signature}", -BR_ENTRY_COST, db)

    p_stats = {
        "attack": hero.stat_attack or 0, "defense": hero.stat_defense or 0,
        "hp": hero.stat_hp or 0, "magic": hero.stat_magic or 0,
        "ranged": hero.stat_ranged or 0, "speed": hero.stat_speed or 0,
    }

    fights: list[dict] = []
    rarity_pools = [
        (["common", "rare", "epic", "legendary"], [55, 30, 12, 3]),
        (["common", "rare", "epic", "legendary"], [40, 35, 18, 7]),
        (["common", "rare", "epic", "legendary"], [28, 35, 25, 12]),
        (["common", "rare", "epic", "legendary"], [18, 32, 30, 20]),
        (["common", "rare", "epic", "legendary"], [10, 28, 35, 27]),
        (["common", "rare", "epic", "legendary"], [5,  22, 38, 35]),
        (["common", "rare", "epic", "legendary"], [3,  15, 37, 45]),
    ]

    won_all = True
    for i, (rarities, weights) in enumerate(rarity_pools):
        o_class  = roll_hero_class()
        o_rarity = random.choices(rarities, weights=weights)[0]
        o_stats_raw = roll_hero_stats(o_class, o_rarity)
        o_stats = {k: o_stats_raw.get(k, 0) for k in ("attack", "defense", "hp", "magic", "ranged", "speed")}
        o_name  = random.choice(AI_NAMES)
        fight   = _br_fight(i + 1, hero.hero_class, p_stats, o_name, o_class, o_rarity, o_stats)
        fights.append(fight)
        if not fight["won"]:
            won_all = False
            break

    runex_earned = 0
    if won_all:
        runex_earned = BR_WIN_RUNEX
        player.runex = (player.runex or 0) + runex_earned
        _log_tx(player.id, "battle_royale_win", "Won Battle Royale — 1,000,000 RuneX!", runex_earned, db)

    db.commit()
    return {
        "ok":          True,
        "won":         won_all,
        "fights":      fights,
        "runex_earned": runex_earned,
        "tokens":      player.tokens,
        "runex":       player.runex or 0,
    }


# ── RuneX Withdraw ───────────────────────────────────────────────────────────

class WithdrawRunexBody(BaseModel):
    amount: float  # whole-unit RuneX to withdraw (min 100)


@app.post("/player/{wallet}/withdraw-runex")
def withdraw_runex(wallet: str, body: WithdrawRunexBody, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.wallet == wallet).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if body.amount < 100:
        raise HTTPException(status_code=400, detail="Minimum withdraw is 100 RuneX")
    player_runex = player.runex or 0
    if player_runex < body.amount:
        raise HTTPException(status_code=400, detail=f"Not enough RuneX (have {player_runex})")
    if not os.getenv("TREASURY_PRIVATE_KEY"):
        raise HTTPException(status_code=503, detail="Withdrawals not yet enabled — treasury key not configured")

    try:
        sig = _send_runex_from_treasury(wallet, body.amount)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    player.runex = player_runex - int(body.amount)
    db.add(Transaction(
        wallet=wallet,
        tx_type="withdraw_runex",
        description=f"Withdrew {int(body.amount)} RuneX → {sig[:12]}…",
        value=-int(body.amount),
    ))
    db.commit()
    return {"ok": True, "signature": sig, "runex": player.runex}


# ── Info ──────────────────────────────────────────────────────────────────────

@app.get("/info")
def game_info():
    return {
        "box_cost":   BOX_COST,
        "expiry_days": EXPIRY_DAYS,
        "chest_drop_per_min": 0.003,
    }
