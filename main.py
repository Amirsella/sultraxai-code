import sqlite3
import hashlib
import hmac
import os
import bcrypt
import random
import re
import uuid
import requests

# Load .env file if it exists (persists across git pulls)
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith('#') and '=' in _line:
                _k, _v = _line.split('=', 1)
                os.environ.setdefault(_k.strip(), _v.strip())
import urllib.request
import xml.etree.ElementTree as ET
import email.utils
import json as _json
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor
import asyncio
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn

BREVO_API_KEY      = os.environ.get("BREVO_API_KEY", "")
FINNHUB_KEY        = os.environ.get("FINNHUB_KEY", "")
GROQ_KEY           = os.environ.get("GROQ_KEY", "")
PAYPAL_CLIENT_ID       = os.environ.get("PAYPAL_CLIENT_ID", "")
PAYPAL_CLIENT_SECRET   = os.environ.get("PAYPAL_CLIENT_SECRET", "")
PAYPAL_PLAN_ID         = os.environ.get("PAYPAL_PLAN_ID", "")
PAYPAL_PLAN_ID_YEARLY  = os.environ.get("PAYPAL_PLAN_ID_YEARLY", "")
PAYPAL_BASE            = "https://api-m.paypal.com"
APP_URL   = "https://sultraxai.com"
ADMIN_KEY = os.environ.get("ADMIN_KEY", "sultrax_admin_key_2026")

# Account lockout: 5 failed attempts → 15 minute lockout
_failed_logins: dict[str, dict] = {}

def _check_lockout(email: str):
    data = _failed_logins.get(email)
    if not data:
        return
    locked_until = data.get("locked_until")
    if locked_until and datetime.now(timezone.utc) < locked_until:
        remaining = int((locked_until - datetime.now(timezone.utc)).total_seconds() / 60) + 1
        raise HTTPException(status_code=429, detail=f"Account locked. Try again in {remaining} minutes.")

def _record_failed_login(email: str):
    data = _failed_logins.setdefault(email, {"count": 0, "locked_until": None})
    data["count"] += 1
    if data["count"] >= 5:
        data["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=15)
        data["count"] = 0
        print(f"[Security] Account locked after 5 failed attempts: {email}")

def _clear_failed_login(email: str):
    _failed_logins.pop(email, None)

reset_tokens = {}

def send_reset_email(to_email: str, reset_link: str) -> bool:
    try:
        res = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": BREVO_API_KEY, "Content-Type": "application/json"},
            json={
                "sender": {"name": "SultraxAI", "email": "support@sultraxai.com"},
                "to": [{"email": to_email}],
                "subject": "SultraxAI - Reset Your Password",
                "htmlContent": f"<p>Click the link below to reset your SultraxAI password:</p><p><a href='{reset_link}' style='background:#ff3333;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin:16px 0'>Reset Password</a></p><p style='color:#888;font-size:12px'>This link expires in 1 hour. If you didn't request this, ignore this email.</p>"
            }
        )
        return res.status_code == 201
    except Exception as e:
        print(f"Reset email error: {e}")
        return False

def send_verification_email(to_email: str, code: str) -> bool:
    try:
        res = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": BREVO_API_KEY, "Content-Type": "application/json"},
            json={
                "sender": {"name": "SultraxAI", "email": "support@sultraxai.com"},
                "to": [{"email": to_email}],
                "subject": "SultraxAI - Verification Code",
                "htmlContent": f"<p>Your SultraxAI verification code is:</p><h2 style='letter-spacing:6px'>{code}</h2><p>Valid for 15 minutes.</p>"
            }
        )
        if res.status_code == 201:
            print(f"Email sent to {to_email}")
            return True
        print(f"Email error: {res.status_code} - {res.text}")
        return False
    except Exception as e:
        print(f"Email error: {e}")
        return False
dist_path = "/root/sultraxai/sultraxai-frontend/dist"

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# In-memory active sessions: {user_id: {last_seen, country, country_code}}
_active_sessions: dict[int, dict] = {}
# IP geolocation cache to avoid re-fetching the same IP
_ip_geo_cache: dict[str, dict] = {}

# נתיב קבוע לבסיס הנתונים
DB_PATH = "/root/sultraxai/sultraxai-frontend/users.db"

@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # HSTS: force HTTPS for 1 year once TLS is active
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT, full_name TEXT, email TEXT UNIQUE, phone TEXT,
            password_hash TEXT, created_at TEXT
        )
    """)
    for _col in ["created_at TEXT", "subscription_status TEXT", "stripe_customer_id TEXT",
                  "subscription_plan TEXT", "subscription_expires TEXT",
                  "subscription_start TEXT", "subscription_cancel_pending INTEGER DEFAULT 0",
                  "username TEXT", "session_token TEXT",
                  "chat_terms_accepted_at TEXT", "chat_terms_accepted_ip TEXT",
                  "reminder_email_sent_at TEXT", "winback_email_sent_at TEXT"]:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {_col}")
        except Exception:
            pass
    try:
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username) WHERE username IS NOT NULL")
    except Exception:
        pass
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, symbol TEXT, threshold REAL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id INTEGER PRIMARY KEY,
            experience TEXT, frequency TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reset_tokens (
            token TEXT PRIMARY KEY,
            email TEXT,
            expiry REAL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_blocked_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT UNIQUE NOT NULL,
            added_at TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS username_blocked_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT UNIQUE NOT NULL,
            added_at TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            first_name TEXT,
            message TEXT,
            created_at TEXT,
            room TEXT DEFAULT 'crypto'
        )
    """)
    try:
        cursor.execute("ALTER TABLE chat_messages ADD COLUMN room TEXT DEFAULT 'crypto'")
    except Exception:
        pass
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS verification_codes_db (
            email TEXT PRIMARY KEY,
            code TEXT,
            expiry REAL
        )
    """)
    conn.commit()
    conn.close()

init_db()

_BLOCKED_USERNAME_TERMS = {
    "fuck","shit","cunt","bitch","cock","pussy","asshole","bastard","whore","slut",
    "dickhead","motherfucker","bullshit","piss","twat",
    "nigger","nigga","kike","spic","chink","gook","wetback","faggot","retard",
    "raghead","beaner","cracker",
    "nazi","hitler","himmler","goebbels","kkk","isis","hamas","hezbollah",
    "alqaeda","taliban","jihad","genocide",
    "porn","dildo","masturbat","pedophile","pedo","rapist","terrorist",
    "admin","moderator","support","official","staff",
}

_BLOCKED_CHAT_TERMS = _BLOCKED_USERNAME_TERMS - {"admin","moderator","support","official","staff"}

_LINK_RE = re.compile(
    r'(https?://|www\.|'
    r'[a-zA-Z0-9\-]+\.(com|net|org|io|co|ru|xyz|gg|tv|me|info|biz|uk|de|fr|es|ca|au|il)(\b|/))',
    re.IGNORECASE
)
_REPEAT_CHAR_RE = re.compile(r'(.)\1{6,}')

_user_msg_log: dict = {}   # user_id → [(timestamp, text), ...]
_user_cooldown: dict = {}  # user_id → cooldown_expires_timestamp

_custom_words_cache: set = set()
_custom_words_cache_ts: float = 0.0
_custom_username_words_cache: set = set()
_custom_username_words_cache_ts: float = 0.0

def _get_custom_blocked_words() -> set:
    global _custom_words_cache, _custom_words_cache_ts
    now = datetime.now(timezone.utc).timestamp()
    if now - _custom_words_cache_ts > 60:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT word FROM chat_blocked_words")
        _custom_words_cache = {r[0].lower() for r in cursor.fetchall()}
        conn.close()
        _custom_words_cache_ts = now
    return _custom_words_cache

def _get_custom_username_blocked_words() -> set:
    global _custom_username_words_cache, _custom_username_words_cache_ts
    now = datetime.now(timezone.utc).timestamp()
    if now - _custom_username_words_cache_ts > 60:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT word FROM username_blocked_words")
        _custom_username_words_cache = {r[0].lower() for r in cursor.fetchall()}
        conn.close()
        _custom_username_words_cache_ts = now
    return _custom_username_words_cache

def _is_english_only(text: str) -> bool:
    """Allow ASCII + emojis. Block Hebrew, Arabic, Cyrillic, CJK, etc."""
    for ch in text:
        cp = ord(ch)
        if cp <= 127:
            continue  # standard ASCII — always OK
        if 0x1F300 <= cp <= 0x1FAFF or 0x2600 <= cp <= 0x27BF:
            continue  # emojis — OK
        if ch.isalpha():
            return False  # non-ASCII letter = non-English script
    return True

def _moderate_chat(user_id: int, text: str):
    """Returns error string or None if message is allowed."""
    if not _is_english_only(text):
        return "English only — please write your message in English"
    if _LINK_RE.search(text):
        return "Links are not allowed in the chat"
    normalized = _leet_normalize(text)
    if any(term in normalized for term in _BLOCKED_CHAT_TERMS):
        return "Message contains prohibited content"
    if any(word in normalized for word in _get_custom_blocked_words()):
        return "Message contains prohibited content"
    if _REPEAT_CHAR_RE.search(text):
        return "Please avoid spamming repeated characters"
    now = datetime.now(timezone.utc).timestamp()
    # Check active cooldown
    cooldown_until = _user_cooldown.get(user_id, 0)
    if now < cooldown_until:
        remaining = int(cooldown_until - now) + 1
        return f"You're on cooldown — wait {remaining}s before sending again"
    # Clean log to last 60 seconds
    log = [(ts, msg) for ts, msg in _user_msg_log.get(user_id, []) if now - ts < 60]
    # Rate limit: max 4 messages per 6 seconds → 15s cooldown
    if len([1 for ts, _ in log if now - ts < 6]) >= 4:
        _user_cooldown[user_id] = now + 15
        return "Slow down — you're sending too many messages. Wait 15 seconds"
    # Same message repeated 2+ times in last 30s
    recent_texts = [msg for ts, msg in log if now - ts < 30]
    if recent_texts.count(text.strip().lower()) >= 2:
        return "Please don't repeat the same message"
    # Consecutive duplicate
    if log and log[-1][1].strip().lower() == text.strip().lower():
        return "Please don't send the same message twice in a row"
    log.append((now, text.strip().lower()))
    _user_msg_log[user_id] = log[-30:]
    return None

def _leet_normalize(s: str) -> str:
    for a, b in [('0','o'),('1','i'),('3','e'),('4','a'),('5','s'),('$','s'),('@','a'),('!','i'),('7','t')]:
        s = s.replace(a, b)
    return s.lower()

def _validate_username(username: str):
    """Returns error string or None if valid."""
    if not username:
        return "Username is required"
    if len(username) < 3:
        return "Username must be at least 3 characters"
    if len(username) > 20:
        return "Username must be at most 20 characters"
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return "Username can only contain letters, numbers, and underscores"
    if not username[0].isalpha():
        return "Username must start with a letter"
    normalized = _leet_normalize(username)
    if any(term in normalized for term in _BLOCKED_USERNAME_TERMS):
        return "This username is not allowed"
    if any(word in normalized for word in _get_custom_username_blocked_words()):
        return "This username is not allowed"
    if any(word in normalized for word in _get_custom_blocked_words()):
        return "This username is not allowed"
    return None

class UserRegister(BaseModel):
    first_name: str; full_name: str; email: EmailStr; phone: str; password: str; username: str

@app.get("/api/check-username")
async def check_username(username: str = ""):
    err = _validate_username(username)
    if err:
        return {"available": False, "error": err}
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE LOWER(username) = ?", (username.lower(),))
    taken = cursor.fetchone() is not None
    conn.close()
    if taken:
        return {"available": False, "error": "This username is already taken"}
    return {"available": True, "error": None}

@app.get("/api/config")
async def get_config(user_id: int = 0, session_token: str = ""):
    if not user_id or not session_token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    _validate_session(user_id, session_token)
    return {"finnhub_key": FINNHUB_KEY}

@app.get("/api/search-stocks")
async def search_stocks(q: str = ""):
    if not q or len(q) < 1:
        return {"results": []}
    try:
        res = requests.get(
            "https://query1.finance.yahoo.com/v1/finance/search",
            params={"q": q, "quotesCount": 10, "newsCount": 0, "enableFuzzyQuery": False},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=5
        )
        quotes = res.json().get("quotes", [])
        results = [
            {"symbol": item["symbol"], "name": item.get("longname") or item.get("shortname", "")}
            for item in quotes if item.get("symbol") and item.get("quoteType") in ("EQUITY", "CRYPTOCURRENCY", "ETF")
        ]
        return {"results": results}
    except Exception as e:
        print(f"Stock search error: {e}")
        return {"results": []}

@app.post("/api/verify-code")
@limiter.limit("10/minute")
async def verify_code(request: Request, data: dict):
    email = (data.get('email') or '').strip().lower()
    code = (data.get('code') or '').strip()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT code, expiry FROM verification_codes_db WHERE email = ?", (email,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return JSONResponse(status_code=400, content={"detail": "Code not found. Please register again."})
    stored_code, expiry = row
    if datetime.now().timestamp() > expiry:
        cursor.execute("DELETE FROM verification_codes_db WHERE email = ?", (email,))
        conn.commit()
        conn.close()
        return JSONResponse(status_code=400, content={"detail": "Code expired. Please register again."})
    if stored_code != code:
        conn.close()
        return JSONResponse(status_code=400, content={"detail": "Invalid code."})
    cursor.execute("DELETE FROM verification_codes_db WHERE email = ?", (email,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, data: dict, background_tasks: BackgroundTasks):
    email = data.get("email", "").strip().lower()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
    user = cursor.fetchone()
    if user:
        token = str(uuid.uuid4())
        expiry = (datetime.now() + timedelta(hours=1)).timestamp()
        cursor.execute("DELETE FROM reset_tokens WHERE email = ?", (email,))
        cursor.execute("INSERT INTO reset_tokens (token, email, expiry) VALUES (?, ?, ?)", (token, email, expiry))
        conn.commit()
        reset_link = f"{APP_URL}/?reset_token={token}"
        background_tasks.add_task(send_reset_email, email, reset_link)
    conn.close()
    return {"status": "success"}

@app.post("/api/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, data: dict):
    token = data.get("token", "")
    new_password = data.get("password", "")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT email, expiry FROM reset_tokens WHERE token = ?", (token,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return JSONResponse(status_code=400, content={"detail": "Invalid or expired link"})
    email, expiry = row
    if datetime.now().timestamp() > expiry:
        cursor.execute("DELETE FROM reset_tokens WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        return JSONResponse(status_code=400, content={"detail": "Link expired. Please request a new one."})
    pwd_hash = hash_password(new_password)
    cursor.execute("UPDATE users SET password_hash = ? WHERE LOWER(email) = ?", (pwd_hash, email))
    cursor.execute("DELETE FROM reset_tokens WHERE token = ?", (token,))
    conn.commit()
    cursor.execute("SELECT id, first_name FROM users WHERE LOWER(email) = ?", (email,))
    user = cursor.fetchone()
    cursor.execute("SELECT experience FROM user_profiles WHERE user_id = ?", (user[0],))
    has_profile = cursor.fetchone() is not None
    cursor.execute("SELECT symbol FROM user_assets WHERE user_id = ?", (user[0],))
    assets = [r[0] for r in cursor.fetchall()]
    conn.close()
    return {"status": "success", "user_id": user[0], "first_name": user[1], "onboarding_completed": has_profile, "assets": assets}

class OnboardingData(BaseModel):
    user_id: int; assets: list; experience: str; frequency: str

class UserLogin(BaseModel):
    email: str; password: str

def hash_password(password: str) -> str:
    """Hash a new password with bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

def _sha256(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain: str, stored: str) -> bool:
    """Verify password against bcrypt or legacy SHA256 hash."""
    if stored.startswith("$2b$") or stored.startswith("$2a$"):
        return bcrypt.checkpw(plain.encode(), stored.encode())
    return hmac.compare_digest(stored, _sha256(plain))

@app.post("/api/register")
@limiter.limit("5/minute")
async def register(request: Request, user: UserRegister, background_tasks: BackgroundTasks):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    email_clean = user.email.strip().lower()
    phone_clean = user.phone.strip()
    username_clean = user.username.strip()

    # Validate username format / content
    username_err = _validate_username(username_clean)
    if username_err:
        conn.close()
        return JSONResponse(status_code=400, content={"detail": username_err})

    # Check username uniqueness
    cursor.execute("SELECT id FROM users WHERE LOWER(username) = ?", (username_clean.lower(),))
    if cursor.fetchone():
        conn.close()
        return JSONResponse(status_code=400, content={"detail": "This username is already taken."})

    # Check email (case-insensitive)
    cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email_clean,))
    if cursor.fetchone():
        conn.close()
        return JSONResponse(status_code=400, content={"detail": "This email is already registered."})

    # Check phone only if provided and non-empty
    if phone_clean:
        cursor.execute("SELECT id FROM users WHERE phone = ?", (phone_clean,))
        if cursor.fetchone():
            conn.close()
            return JSONResponse(status_code=400, content={"detail": "This phone number is already registered."})

    pwd_hash = hash_password(user.password)
    try:
        cursor.execute("INSERT INTO users (first_name, full_name, email, phone, password_hash, created_at, username) VALUES (?, ?, ?, ?, ?, ?, ?)",
                       (user.first_name, user.full_name, email_clean, phone_clean or '', pwd_hash, datetime.now().isoformat(), username_clean))
        user_id = cursor.lastrowid
        conn.commit()
    except Exception as e:
        conn.close()
        print(f"Register insert error for {email_clean}: {e}")
        return JSONResponse(status_code=500, content={"detail": f"Registration failed: {str(e)}"})

    code = str(random.randint(100000, 999999))
    expiry = (datetime.now() + timedelta(minutes=30)).timestamp()
    cursor.execute("INSERT OR REPLACE INTO verification_codes_db (email, code, expiry) VALUES (?, ?, ?)",
                   (email_clean, code, expiry))
    conn.commit()
    conn.close()
    print(f"New user registered: id={user_id}, email={email_clean}, code={code}")
    background_tasks.add_task(send_verification_email, email_clean, code)
    return {"status": "success", "user_id": user_id}
@app.post("/api/complete-onboarding")
async def complete_onboarding(data: OnboardingData):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM user_assets WHERE user_id = ?", (data.user_id,))
        cursor.execute("DELETE FROM user_profiles WHERE user_id = ?", (data.user_id,))
        for asset in data.assets:
            cursor.execute("INSERT INTO user_assets (user_id, symbol, threshold) VALUES (?, ?, ?)",
                           (data.user_id, asset['symbol'], asset['threshold']))
        cursor.execute("INSERT INTO user_profiles (user_id, experience, frequency) VALUES (?, ?, ?)",
                       (data.user_id, data.experience, data.frequency))
        conn.commit()
    except Exception as e:
        conn.close()
        return JSONResponse(status_code=500, content={"detail": str(e)})
    conn.close()
    return {"status": "success"}

def _fetch_one(sym):
    try:
        fi = yf.Ticker(sym).fast_info
        price = fi.last_price
        prev = fi.previous_close
        change_pct = ((price - prev) / prev * 100) if prev else 0
        return sym, {"price": round(float(price), 4), "change_pct": round(float(change_pct), 4), "prev_close": round(float(prev), 4)}
    except Exception as e:
        print(f"yfinance error {sym}: {e}")
        return sym, None

@app.get("/api/prices")
async def get_prices(symbols: str = ""):
    if not symbols:
        return {"prices": {}}
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
    with ThreadPoolExecutor(max_workers=len(symbol_list)) as ex:
        results = ex.map(_fetch_one, symbol_list)
    return {"prices": {sym: data for sym, data in results if data}}

def _fetch_avg_volume_one(sym):
    try:
        hist = yf.Ticker(sym).history(period="20d", interval="1d")
        volumes = hist["Volume"].dropna().tolist()
        if not volumes:
            return sym, None
        return sym, round(float(sum(volumes) / len(volumes)))
    except Exception as e:
        print(f"Avg volume error {sym}: {e}")
        return sym, None

@app.get("/api/avg-volume")
async def get_avg_volume(symbols: str = ""):
    if not symbols:
        return {"volumes": {}}
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
    with ThreadPoolExecutor(max_workers=min(len(symbol_list), 10)) as ex:
        results = list(ex.map(_fetch_avg_volume_one, symbol_list))
    return {"volumes": {sym: vol for sym, vol in results if vol is not None}}

def _fetch_history_one(sym):
    try:
        hist = yf.Ticker(sym).history(period="5d", interval="5m")
        closes = hist["Close"].dropna().tolist()
        return sym, [round(float(p), 4) for p in closes[-30:]]
    except Exception as e:
        print(f"History error {sym}: {e}")
        return sym, []

@app.get("/api/history-batch")
async def get_history_batch(symbols: str = ""):
    if not symbols:
        return {"history": {}}
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
    with ThreadPoolExecutor(max_workers=min(len(symbol_list), 10)) as ex:
        results = list(ex.map(_fetch_history_one, symbol_list))
    return {"history": {sym: prices for sym, prices in results}}

@app.get("/api/user-assets/{user_id}")
async def get_user_assets(user_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT symbol, threshold FROM user_assets WHERE user_id = ?", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return {"assets": [{"symbol": r[0], "threshold": r[1]} for r in rows]}

class UpdateAssets(BaseModel):
    user_id: int
    assets: list
    session_token: str = ""

@app.post("/api/update-assets")
async def update_assets(data: UpdateAssets):
    _validate_session(data.user_id, data.session_token)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM user_assets WHERE user_id = ?", (data.user_id,))
        for asset in data.assets:
            cursor.execute("INSERT INTO user_assets (user_id, symbol, threshold) VALUES (?, ?, ?)",
                           (data.user_id, asset['symbol'], asset['threshold']))
        conn.commit()
    except Exception as e:
        conn.close()
        return JSONResponse(status_code=500, content={"detail": str(e)})
    conn.close()
    return {"status": "success"}

@app.get("/api/user/{user_id}")
async def get_user(user_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT first_name, full_name, email, phone, subscription_status,
               subscription_plan, subscription_expires, subscription_start,
               subscription_cancel_pending, stripe_customer_id, username
        FROM users WHERE id = ?
    """, (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return JSONResponse(status_code=404, content={"detail": "User not found"})
    cursor.execute("SELECT experience, frequency FROM user_profiles WHERE user_id = ?", (user_id,))
    profile = cursor.fetchone()
    conn.close()
    return {
        "first_name": row[0], "full_name": row[1], "email": row[2], "phone": row[3],
        "subscription_status": row[4] or "",
        "subscription_plan": row[5] or "",
        "subscription_expires": row[6] or "",
        "subscription_start": row[7] or "",
        "subscription_cancel_pending": bool(row[8]),
        "has_paypal_sub": bool(row[9]),
        "username": row[10] or "",
        "experience": profile[0] if profile else "Beginner (0-1 yrs)",
        "frequency": profile[1] if profile else "Daily"
    }

@app.post("/api/update-profile")
async def update_profile(data: dict):
    user_id = data.get("user_id")
    _validate_session(user_id, data.get("session_token", ""))
    first_name = data.get("first_name", "").strip()
    full_name = data.get("full_name", "").strip()
    phone = data.get("phone", "").strip()
    experience = data.get("experience")
    frequency = data.get("frequency")
    new_username = data.get("username", "").strip()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    if new_username:
        err = _validate_username(new_username)
        if err:
            conn.close()
            return JSONResponse(status_code=400, content={"detail": err})
        cursor.execute("SELECT id FROM users WHERE LOWER(username) = ? AND id != ?", (new_username.lower(), user_id))
        if cursor.fetchone():
            conn.close()
            return JSONResponse(status_code=400, content={"detail": "This username is already taken."})
        cursor.execute("UPDATE users SET first_name = ?, full_name = ?, phone = ?, username = ? WHERE id = ?",
                       (first_name, full_name, phone, new_username, user_id))
    else:
        cursor.execute("UPDATE users SET first_name = ?, full_name = ?, phone = ? WHERE id = ?",
                       (first_name, full_name, phone, user_id))

    if experience and frequency:
        cursor.execute("INSERT OR REPLACE INTO user_profiles (user_id, experience, frequency) VALUES (?, ?, ?)",
                       (user_id, experience, frequency))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/change-password")
async def change_password_endpoint(data: dict):
    user_id = data.get("user_id")
    _validate_session(user_id, data.get("session_token", ""))
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return JSONResponse(status_code=404, content={"detail": "User not found"})
    if not verify_password(current_password, row[0]):
        conn.close()
        return JSONResponse(status_code=400, content={"detail": "Current password is incorrect"})
    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(new_password), user_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.delete("/api/delete-account/{user_id}")
async def delete_account(user_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_assets WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM user_profiles WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM reset_tokens WHERE email = (SELECT email FROM users WHERE id = ?)", (user_id,))
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

def _zone_news(symbol: str) -> list:
    try:
        is_crypto = '-USD' in symbol or '/' in symbol
        if is_crypto:
            res = requests.get("https://finnhub.io/api/v1/news",
                params={"category": "crypto", "token": FINNHUB_KEY},
                headers={"User-Agent": "SultraxAI/1.0"}, timeout=5)
        else:
            from_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
            to_date = datetime.now().strftime('%Y-%m-%d')
            res = requests.get("https://finnhub.io/api/v1/company-news",
                params={"symbol": symbol, "from": from_date, "to": to_date, "token": FINNHUB_KEY},
                headers={"User-Agent": "SultraxAI/1.0"}, timeout=5)
        items = res.json() if isinstance(res.json(), list) else []
        return [{"headline": i.get("headline",""), "summary": (i.get("summary","") or "")[:220],
                 "source": i.get("source",""), "url": i.get("url",""), "time": i.get("datetime",0)}
                for i in items[:15] if i.get("headline")]
    except Exception as e:
        print(f"Zone news error: {e}"); return []

def _zone_stocktwits(symbol: str) -> list:
    try:
        if '-USD' in symbol:
            st_sym = symbol.replace('-USD', '.X')
        elif '/' in symbol:
            st_sym = symbol.split('/')[0] + '.X'
        else:
            st_sym = symbol
        url = f"https://api.stocktwits.com/api/2/streams/symbol/{st_sym}.json"
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Referer": "https://stocktwits.com/",
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = _json.loads(resp.read().decode("utf-8"))
        msgs = data.get("messages", [])[:20]
        return [{"text": m.get("body",""), "user": m.get("user",{}).get("username",""),
                 "sentiment": m.get("entities",{}).get("sentiment",{}).get("basic",""),
                 "likes": m.get("likes",{}).get("total",0), "time": m.get("created_at","")}
                for m in msgs if m.get("body")]
    except Exception as e:
        print(f"Zone StockTwits error: {e}"); return []

def _zone_yahoo(symbol: str) -> list:
    try:
        ticker = symbol.replace('-USD','').replace('/','').split('.')[0]
        url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/rss+xml, application/xml, text/xml",
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            root = ET.fromstring(resp.read())
        result = []
        for item in root.findall('.//item')[:15]:
            title = (item.findtext('title') or '').strip()
            link = item.findtext('link') or ''
            pub_date = item.findtext('pubDate') or ''
            try:
                ts = email.utils.parsedate_to_datetime(pub_date).timestamp()
            except Exception:
                ts = 0
            if title:
                result.append({"headline": title, "summary": "", "source": "Yahoo Finance", "url": link, "time": ts})
        return result
    except Exception as e:
        print(f"Zone Yahoo error: {e}"); return []

_SCAN_STOCKS = [
    # Mega cap tech
    "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AVGO","ORCL","ADBE",
    "CRM","CSCO","IBM","INTC","QCOM","AMD","MU","SMCI","ARM",
    # Finance
    "JPM","BAC","GS","MS","V","MA","PYPL","COIN","HOOD","SOFI","C","WFC","AXP","SCHW",
    # Healthcare
    "LLY","UNH","ABBV","MRK","PFE","JNJ","MRNA","AMGN","GILD","REGN",
    # Energy
    "XOM","CVX","OXY","COP","SLB",
    # Consumer & Retail
    "HD","COST","WMT","NKE","MCD","SBUX","TGT",
    # Industrials & Transport
    "BA","LMT","RTX","CAT","UPS","FDX",
    # Auto & EV
    "F","GM","NIO","RIVN",
    # Growth / Disruptive
    "PLTR","MSTR","RKLB","NET","SNOW","DDOG","PANW","ZS",
    # Media & Streaming
    "NFLX","DIS","SPOT","SNAP","RBLX","PINS",
    # Travel & Mobility
    "UBER","LYFT","ABNB","BKNG",
    # Popular trading
    "GME","AMC",
    # ETFs
    "SPY","QQQ","IWM","ARKK","GLD","SLV","TLT",
]

_SCAN_CRYPTO = {
    "BINANCE:BTCUSDT":  "BTC-USD",
    "BINANCE:ETHUSDT":  "ETH-USD",
    "BINANCE:SOLUSDT":  "SOL-USD",
    "BINANCE:XRPUSDT":  "XRP-USD",
    "BINANCE:BNBUSDT":  "BNB-USD",
    "BINANCE:ADAUSDT":  "ADA-USD",
    "BINANCE:DOGEUSDT": "DOGE-USD",
    "BINANCE:AVAXUSDT": "AVAX-USD",
    "BINANCE:DOTUSDT":  "DOT-USD",
    "BINANCE:LINKUSDT": "LINK-USD",
    "BINANCE:LTCUSDT":  "LTC-USD",
    "BINANCE:ATOMUSDT": "ATOM-USD",
}

SCAN_UNIVERSE = _SCAN_STOCKS + list(_SCAN_CRYPTO.keys())

_scanner_cache = {"movers": [], "scanned": 0, "updated": None}
_zone_cache = {}  # {symbol: {"news": [], "stocktwits": [], "yahoo": [], "updated": datetime}}

def _fetch_quote(symbol: str):
    try:
        res = requests.get("https://finnhub.io/api/v1/quote",
            params={"symbol": symbol, "token": FINNHUB_KEY}, timeout=5)
        if res.status_code != 200:
            return None
        d = res.json()
        price = d.get("c", 0)
        pct = d.get("dp", 0)
        if not price or price == 0:
            return None
        display = _SCAN_CRYPTO.get(symbol, symbol)
        return {
            "symbol": display,
            "price": round(price, 2),
            "change": round(d.get("d", 0), 2),
            "pct": round(pct, 2),
            "high": round(d.get("h", 0), 2),
            "low": round(d.get("l", 0), 2),
            "prev_close": round(d.get("pc", 0), 2),
        }
    except Exception:
        return None

def _run_scanner_sync():
    with ThreadPoolExecutor(max_workers=15) as ex:
        results = list(ex.map(_fetch_quote, SCAN_UNIVERSE))
    movers = [r for r in results if r]
    movers.sort(key=lambda x: abs(x["pct"]), reverse=True)
    _scanner_cache["movers"] = movers
    _scanner_cache["scanned"] = len(movers)
    _scanner_cache["updated"] = datetime.now().isoformat()

async def _scanner_background_loop():
    loop = asyncio.get_event_loop()
    while True:
        try:
            await loop.run_in_executor(None, _run_scanner_sync)
        except Exception as e:
            print(f"Scanner background error: {e}")
        await asyncio.sleep(60)

async def _zone_background_loop():
    while True:
        try:
            conn = sqlite3.connect(DB_PATH)
            rows = conn.execute("SELECT DISTINCT symbol FROM user_assets").fetchall()
            conn.close()
            symbols = [r[0] for r in rows]
            for sym in symbols:
                try:
                    with ThreadPoolExecutor(max_workers=3) as ex:
                        nf = ex.submit(_zone_news, sym)
                        sf = ex.submit(_zone_stocktwits, sym)
                        yf = ex.submit(_zone_yahoo, sym)
                        news, twits, yahoo = nf.result(), sf.result(), yf.result()
                    _zone_cache[sym] = {"news": news, "stocktwits": twits, "yahoo": yahoo, "updated": datetime.now()}
                except Exception as e:
                    print(f"Zone cache error for {sym}: {e}")
                await asyncio.sleep(2)
        except Exception as e:
            print(f"Zone background error: {e}")
        await asyncio.sleep(10 * 60)

@app.on_event("startup")
async def start_scanner_loop():
    asyncio.create_task(_scanner_background_loop())
    asyncio.create_task(_zone_background_loop())

@app.get("/api/scanner")
async def get_scanner(threshold: float = 1.0):
    movers = [m for m in _scanner_cache["movers"] if abs(m["pct"]) >= threshold]
    return {
        "movers": movers,
        "total_scanned": _scanner_cache["scanned"],
        "threshold": threshold,
        "updated": _scanner_cache["updated"],
    }

_SUPPORT_SYSTEM = """You are the SultraxAI support assistant — a knowledgeable, concise helper for traders using the SultraxAI platform.

About SultraxAI:
SultraxAI is a real-time market intelligence terminal for active traders. It tracks stocks and crypto, sends price alerts, and surfaces news + social signals.

Platform features:
- DASHBOARD: Real-time price cards for all your watchlist assets (stocks & crypto). Each card shows current price, % change from previous close, a sparkline, and volume data. A scrolling ticker at the top shows the 20 biggest movers right now. Click any ticker symbol to open its TradingView chart.
- THE ZONE: A unified intel feed merging news from Finnhub, social posts from StockTwits, and headlines from Yahoo Finance — all sorted by time. Each item is tagged with its source (FINNHUB / STOCKTWITS / YAHOO). Filter by source. Refreshes every 90 seconds.
- SCANNER: Scans ~100 stocks and 12 crypto assets every 60 seconds for unusual price movements. Sorted by biggest % move. Filter by >1%, >2%, >5%, >10%. Click a symbol to open its chart instantly.
- SMART ALERTS: Set a custom price-move threshold per asset (1%, 2%, or 5%). When an asset crosses its threshold, an alert appears in the Alerts tab. The dashboard also detects unusual volume (relative volume spikes).
- ACCOUNT SETTINGS: Update your name, phone, experience level, and check frequency. Change your password. Delete your account from the Danger Zone tab.
- ONBOARDING: When registering, you select at least 3 assets to follow and set alert sensitivity per asset.

Common tasks:
- Add assets: click "+ Watchlist" on the dashboard, search by name or ticker.
- Change alert threshold: click the asset card on the dashboard to expand it, then select a sensitivity level.
- Forgot password: on the Sign In page, click "Forgot password?" to receive a reset email.
- Navigate: use the top nav bar — DASHBOARD, THE ZONE, SCANNER, ACCOUNT, SIGN OUT.

Tone: be short, direct, and helpful. Use plain language. No fluff. If unsure, say so honestly."""

class SupportRequest(BaseModel):
    messages: list

@app.post("/api/support/chat")
async def support_chat(req: SupportRequest):
    if not GROQ_KEY or GROQ_KEY.startswith("YOUR_"):
        raise HTTPException(status_code=503, detail="Support not configured")
    history = req.messages[-12:]
    groq_messages = [{"role": "system", "content": _SUPPORT_SYSTEM}] + history
    try:
        res = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.1-8b-instant",
                "max_tokens": 400,
                "messages": groq_messages,
            },
            timeout=15,
        )
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="AI service error")
        return {"reply": res.json()["choices"][0]["message"]["content"]}
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="Request timed out")

@app.get("/api/zone/all")
async def get_zone_all(symbol: str):
    if symbol in _zone_cache:
        cached = _zone_cache[symbol]
        news, twits, yahoo = cached["news"], cached["stocktwits"], cached["yahoo"]
    else:
        with ThreadPoolExecutor(max_workers=3) as ex:
            nf = ex.submit(_zone_news, symbol)
            sf = ex.submit(_zone_stocktwits, symbol)
            yf_fut = ex.submit(_zone_yahoo, symbol)
            news, twits, yahoo = nf.result(), sf.result(), yf_fut.result()
        _zone_cache[symbol] = {"news": news, "stocktwits": twits, "yahoo": yahoo, "updated": datetime.now()}
    bull = sum(1 for m in twits if m.get("sentiment") == "Bullish")
    bear = sum(1 for m in twits if m.get("sentiment") == "Bearish")
    total = bull + bear
    return {"symbol": symbol, "news": news, "stocktwits": twits, "yahoo": yahoo,
            "sentiment": {"bull": bull, "bear": bear, "pct": round(bull/total*100) if total else 50}}

class ContactMessage(BaseModel):
    name: str
    email: str
    subject: str
    message: str

@app.post("/api/contact")
async def contact(msg: ContactMessage):
    try:
        requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": BREVO_API_KEY, "Content-Type": "application/json"},
            json={
                "sender": {"name": "SultraxAI Contact", "email": "support@sultraxai.com"},
                "to": [{"email": "support@sultraxai.com"}],
                "replyTo": {"email": msg.email, "name": msg.name},
                "subject": f"[Contact] {msg.subject}",
                "htmlContent": f"<p><b>From:</b> {msg.name} ({msg.email})</p><p><b>Subject:</b> {msg.subject}</p><p><b>Message:</b></p><p>{msg.message}</p>"
            }
        )
    except Exception as e:
        print(f"Contact email error: {e}")
    return {"status": "ok"}

# Admin sessions: short-lived tokens issued by /api/admin/auth (never leave the server)
_admin_sessions: dict[str, datetime] = {}  # token -> expiry

@app.post("/api/admin/auth")
@limiter.limit("5/minute")
async def admin_auth_endpoint(request: Request, data: dict):
    password = data.get("password", "")
    if not hmac.compare_digest(password, ADMIN_KEY):
        print(f"[Security] Failed admin auth attempt from {get_remote_address(request)}")
        raise HTTPException(status_code=403, detail="Forbidden")
    token = str(uuid.uuid4())
    _admin_sessions[token] = datetime.now(timezone.utc) + timedelta(hours=8)
    return {"token": token}

def _admin_auth(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=403, detail="Forbidden")
    token = auth[7:]
    expiry = _admin_sessions.get(token)
    if not expiry or datetime.now(timezone.utc) > expiry:
        _admin_sessions.pop(token, None)
        raise HTTPException(status_code=403, detail="Forbidden")

def _validate_session(user_id: int, session_token: str):
    """Raise 401 if the provided token doesn't match the active session in DB.
    If no token is provided we skip validation (backward compat for old clients)."""
    if not session_token:
        return
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("SELECT session_token FROM users WHERE id=?", (user_id,)).fetchone()
    conn.close()
    if row and row[0] and row[0] != session_token:
        raise HTTPException(status_code=401, detail="session_replaced")

@app.get("/api/admin/users")
async def admin_list_users(request: Request):
    _admin_auth(request)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.first_name, u.full_name, u.email, u.phone, u.created_at,
               u.subscription_status, u.subscription_plan, u.subscription_expires,
               COUNT(DISTINCT a.id) as asset_count,
               GROUP_CONCAT(a.symbol, ', ') as assets,
               p.experience, p.frequency
        FROM users u
        LEFT JOIN user_assets a ON a.user_id = u.id
        LEFT JOIN user_profiles p ON p.user_id = u.id
        GROUP BY u.id
        ORDER BY u.id DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return {"users": [dict(r) for r in rows], "total": len(rows)}

@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(user_id: int, request: Request):
    _admin_auth(request)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_assets WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM user_profiles WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM reset_tokens WHERE email = (SELECT email FROM users WHERE id = ?)", (user_id,))
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    print(f"Admin deleted user id={user_id}")
    return {"status": "success"}

@app.post("/api/login")
@limiter.limit("10/minute")
async def login(request: Request, user: UserLogin):
    email_clean = user.email.strip().lower()
    _check_lockout(email_clean)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT id, first_name, password_hash, subscription_status, stripe_customer_id FROM users WHERE LOWER(email) = ?", (email_clean,))
    row = cursor.fetchone()

    if not row:
        _record_failed_login(email_clean)
        conn.close()
        return JSONResponse(status_code=401, content={"detail": "User not found"})

    user_id, first_name, stored_pwd_hash, subscription_status, sub_id = row
    if not verify_password(user.password, stored_pwd_hash):
        _record_failed_login(email_clean)
        conn.close()
        return JSONResponse(status_code=401, content={"detail": "Wrong password"})
    _clear_failed_login(email_clean)
    # Transparent upgrade: re-hash SHA256 passwords to bcrypt on successful login
    if not (stored_pwd_hash.startswith("$2b$") or stored_pwd_hash.startswith("$2a$")):
        conn.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(user.password), user_id))
        conn.commit()

    cursor.execute("SELECT experience FROM user_profiles WHERE user_id = ?", (user_id,))
    has_profile = cursor.fetchone() is not None
    cursor.execute("SELECT symbol FROM user_assets WHERE user_id = ?", (user_id,))
    assets = [r[0] for r in cursor.fetchall()]

    # Verify subscription with PayPal in real-time if user has a subscription ID
    if subscription_status == 'active' and sub_id and PAYPAL_CLIENT_ID:
        try:
            token = _paypal_token()
            res = requests.get(
                f"{PAYPAL_BASE}/v1/billing/subscriptions/{sub_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=8
            )
            if res.status_code == 200:
                sub_data = res.json()
                paypal_status = sub_data.get("status", "")
                if paypal_status not in ("ACTIVE", "TRIALING", "APPROVED"):
                    # Check if cancelled but still within paid period
                    cursor.execute("SELECT subscription_expires FROM users WHERE id=?", (user_id,))
                    exp_row = cursor.fetchone()
                    expires_str = exp_row[0] if exp_row else None
                    keep_access = False
                    if expires_str:
                        try:
                            exp_dt = datetime.fromisoformat(expires_str.replace("Z", "+00:00"))
                            keep_access = exp_dt > datetime.now(timezone.utc)
                        except Exception:
                            pass
                    if not keep_access:
                        subscription_status = ''
                        cursor.execute("UPDATE users SET subscription_status='' WHERE id=?", (user_id,))
                        conn.commit()
                        print(f"[Login] user={user_id} sub revoked, PayPal status={paypal_status}")
        except Exception as e:
            print(f"[Login] PayPal check failed (non-blocking): {e}")

    # Generate a new session token — invalidates any previous active session for this account
    session_token = str(uuid.uuid4())
    conn2 = sqlite3.connect(DB_PATH)
    conn2.execute("UPDATE users SET session_token=? WHERE id=?", (session_token, user_id))
    conn2.commit()
    conn2.close()

    conn3 = sqlite3.connect(DB_PATH)
    terms_row = conn3.execute("SELECT chat_terms_accepted_at FROM users WHERE id=?", (user_id,)).fetchone()
    conn3.close()
    chat_terms_accepted = bool(terms_row and terms_row[0])

    return {"user_id": user_id, "first_name": first_name, "onboarding_completed": has_profile,
            "assets": assets, "subscription_status": subscription_status or "",
            "session_token": session_token, "chat_terms_accepted": chat_terms_accepted}

    
def _check_subscriptions_sync():
    if not PAYPAL_CLIENT_ID:
        return
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, stripe_customer_id, subscription_expires FROM users "
        "WHERE subscription_status='active' AND stripe_customer_id IS NOT NULL AND stripe_customer_id != ''"
    )
    rows = cursor.fetchall()
    conn.close()
    if not rows:
        return
    try:
        token = _paypal_token()
    except Exception as e:
        print(f"[SubChecker] PayPal token error: {e}")
        return
    now = datetime.now(timezone.utc)
    expired = []
    updates = []
    for user_id, sub_id, sub_expires in rows:
        try:
            res = requests.get(
                f"{PAYPAL_BASE}/v1/billing/subscriptions/{sub_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            if res.status_code == 200:
                sub = res.json()
                status = sub.get("status", "")
                next_billing = (sub.get("billing_info") or {}).get("next_billing_time", "")
                if status in ("ACTIVE", "TRIALING"):
                    if next_billing:
                        updates.append((next_billing, user_id))
                else:
                    # CANCELLED — keep access until the paid period ends
                    expires_dt = None
                    try:
                        if sub_expires:
                            expires_dt = datetime.fromisoformat(sub_expires.replace("Z", "+00:00"))
                    except Exception:
                        pass
                    if expires_dt and expires_dt > now:
                        updates.append((sub_expires, user_id))  # refresh expires, keep active
                        print(f"[SubChecker] user={user_id} cancelled but active until {sub_expires}")
                    else:
                        expired.append(user_id)
                        print(f"[SubChecker] user={user_id} sub={sub_id} status={status} → revoked")
            else:
                print(f"[SubChecker] user={user_id} sub={sub_id} HTTP {res.status_code}")
        except Exception as e:
            print(f"[SubChecker] user={user_id} error: {e}")
    # Also revoke cancel_pending subs whose expiry date has passed (no PayPal call needed)
    try:
        conn2 = sqlite3.connect(DB_PATH)
        c2 = conn2.cursor()
        c2.execute(
            "SELECT id FROM users WHERE subscription_cancel_pending=1 AND subscription_status='active' "
            "AND subscription_expires != '' AND subscription_expires IS NOT NULL AND subscription_expires < ?",
            (now.isoformat(),)
        )
        date_expired = [r[0] for r in c2.fetchall()]
        conn2.close()
        expired.extend(date_expired)
        if date_expired:
            print(f"[SubChecker] {len(date_expired)} cancel_pending sub(s) expired by date")
    except Exception as e:
        print(f"[SubChecker] date-check error: {e}")

    if expired or updates:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        for uid in set(expired):
            cursor.execute("UPDATE users SET subscription_status='' WHERE id=?", (uid,))
        for next_billing, uid in updates:
            cursor.execute("UPDATE users SET subscription_expires=? WHERE id=?", (next_billing, uid))
        conn.commit()
        conn.close()
        if expired:
            print(f"[SubChecker] Revoked {len(expired)} subscription(s)")

async def _subscription_checker_loop():
    loop = asyncio.get_event_loop()
    while True:
        print("[SubChecker] Running daily subscription check...")
        await loop.run_in_executor(None, _check_subscriptions_sync)
        await asyncio.sleep(24 * 60 * 60)

def send_abandoned_checkout_email(to_email: str, first_name: str) -> bool:
    try:
        res = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": BREVO_API_KEY, "Content-Type": "application/json"},
            json={
                "sender": {"name": "SultraxAI", "email": "support@sultraxai.com"},
                "to": [{"email": to_email}],
                "subject": "You're one step away from the signal",
                "htmlContent": f"""
<div style="background:#080808;color:#fff;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;border-radius:16px">
  <div style="font-size:1.3rem;font-weight:900;letter-spacing:0.08em;color:#ff3333;margin-bottom:8px">SULTRAX<span style="color:#fff">AI</span></div>
  <div style="font-size:0.7rem;color:#555;letter-spacing:0.2em;margin-bottom:36px">THE SIGNAL BEFORE THE NOISE</div>

  <h2 style="font-size:1.4rem;font-weight:800;margin:0 0 16px;line-height:1.3">Hey {first_name}, your setup is complete.</h2>
  <p style="color:#888;font-size:0.9rem;line-height:1.7;margin:0 0 24px">
    You picked your assets, set your alerts, and built your profile.<br>
    The only thing left — unlock the terminal.
  </p>

  <div style="background:#0d0d0d;border:1px solid #1a1a1a;border-radius:12px;padding:20px 24px;margin-bottom:28px">
    <div style="font-size:0.75rem;font-weight:700;color:#555;letter-spacing:0.12em;margin-bottom:14px">WHAT YOU GET</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;gap:12px;font-size:0.85rem;color:#ccc">
        <span style="color:#ff3333;font-weight:900">→</span> Real-time price alerts on your watchlist
      </div>
      <div style="display:flex;align-items:center;gap:12px;font-size:0.85rem;color:#ccc">
        <span style="color:#ff3333;font-weight:900">→</span> Live market data — crypto &amp; stocks
      </div>
      <div style="display:flex;align-items:center;gap:12px;font-size:0.85rem;color:#ccc">
        <span style="color:#ff3333;font-weight:900">→</span> Community chat with active traders
      </div>
      <div style="display:flex;align-items:center;gap:12px;font-size:0.85rem;color:#ccc">
        <span style="color:#ff3333;font-weight:900">→</span> AI-powered market scanner
      </div>
    </div>
  </div>

  <a href="{APP_URL}" style="display:block;background:#ff3333;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:800;font-size:0.9rem;letter-spacing:0.06em;margin-bottom:24px">
    COMPLETE MY SUBSCRIPTION →
  </a>

  <p style="color:#333;font-size:0.75rem;text-align:center;margin:0;line-height:1.6">
    Questions? Reply to this email — we read everything.<br>
    <a href="{APP_URL}" style="color:#555">sultraxai.com</a>
  </p>
</div>
"""
            }
        )
        return res.status_code == 201
    except Exception as e:
        print(f"[Reminder] Email error to {to_email}: {e}")
        return False

def send_winback_email(to_email: str, first_name: str) -> bool:
    try:
        res = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": BREVO_API_KEY, "Content-Type": "application/json"},
            json={
                "sender": {"name": "SultraxAI", "email": "support@sultraxai.com"},
                "to": [{"email": to_email}],
                "subject": "The market didn't wait — come back",
                "htmlContent": f"""
<div style="background:#080808;color:#fff;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;border-radius:16px">
  <div style="font-size:1.3rem;font-weight:900;letter-spacing:0.08em;color:#ff3333;margin-bottom:8px">SULTRAX<span style="color:#fff">AI</span></div>
  <div style="font-size:0.7rem;color:#555;letter-spacing:0.2em;margin-bottom:36px">THE SIGNAL BEFORE THE NOISE</div>

  <h2 style="font-size:1.4rem;font-weight:800;margin:0 0 16px;line-height:1.3">Hey {first_name}, we noticed you've been away.</h2>
  <p style="color:#888;font-size:0.9rem;line-height:1.7;margin:0 0 24px">
    Your account is still here. Your watchlist is still set up.<br>
    The market kept moving — your terminal is ready when you are.
  </p>

  <div style="background:#0d0d0d;border:1px solid #1a1a1a;border-radius:12px;padding:20px 24px;margin-bottom:28px">
    <div style="font-size:0.75rem;font-weight:700;color:#555;letter-spacing:0.12em;margin-bottom:14px">STILL WAITING FOR YOU</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="font-size:0.85rem;color:#ccc"><span style="color:#ff3333;font-weight:900">→</span> Real-time alerts the moment price moves</div>
      <div style="font-size:0.85rem;color:#ccc"><span style="color:#ff3333;font-weight:900">→</span> Live data — crypto &amp; stocks, no delay</div>
      <div style="font-size:0.85rem;color:#ccc"><span style="color:#ff3333;font-weight:900">→</span> Community of active traders, live now</div>
      <div style="font-size:0.85rem;color:#ccc"><span style="color:#ff3333;font-weight:900">→</span> AI scanner — catch moves before they happen</div>
    </div>
  </div>

  <a href="{APP_URL}" style="display:block;background:#ff3333;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:800;font-size:0.9rem;letter-spacing:0.06em;margin-bottom:24px">
    REACTIVATE MY ACCOUNT →
  </a>

  <p style="color:#333;font-size:0.75rem;text-align:center;margin:0;line-height:1.6">
    Questions? Reply to this email — we read everything.<br>
    <a href="{APP_URL}" style="color:#555">sultraxai.com</a>
  </p>
</div>
"""
            }
        )
        return res.status_code == 201
    except Exception as e:
        print(f"[Winback] Email error to {to_email}: {e}")
        return False

def _send_lifecycle_emails():
    if not BREVO_API_KEY:
        return
    cutoff_24h = (datetime.now() - timedelta(hours=24)).isoformat()
    cutoff_7d  = (datetime.now() - timedelta(days=7)).isoformat()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Abandoned checkout: registered > 24h, completed onboarding, NEVER had a subscription
    cursor.execute("""
        SELECT u.id, u.email, u.first_name FROM users u
        INNER JOIN user_profiles p ON p.user_id = u.id
        WHERE (u.subscription_status IS NULL OR u.subscription_status = '')
          AND (u.subscription_start IS NULL OR u.subscription_start = '')
          AND (u.reminder_email_sent_at IS NULL OR u.reminder_email_sent_at = '')
          AND u.created_at < ?
          AND u.email IS NOT NULL AND u.email != ''
    """, (cutoff_24h,))
    abandoned = cursor.fetchall()

    # Win-back: subscription expired > 7 days ago, not yet sent win-back
    cursor.execute("""
        SELECT u.id, u.email, u.first_name FROM users u
        WHERE (u.subscription_status IS NULL OR u.subscription_status = '')
          AND u.subscription_start IS NOT NULL AND u.subscription_start != ''
          AND (u.winback_email_sent_at IS NULL OR u.winback_email_sent_at = '')
          AND u.subscription_expires IS NOT NULL
          AND u.subscription_expires < ?
          AND u.email IS NOT NULL AND u.email != ''
    """, (cutoff_7d,))
    expired = cursor.fetchall()
    conn.close()

    for user_id, email, first_name in abandoned:
        if send_abandoned_checkout_email(email, first_name or "there"):
            c = sqlite3.connect(DB_PATH)
            c.execute("UPDATE users SET reminder_email_sent_at=? WHERE id=?",
                      (datetime.now().isoformat(), user_id))
            c.commit(); c.close()
            print(f"[Abandoned] Sent to user_id={user_id} ({email})")

    for user_id, email, first_name in expired:
        if send_winback_email(email, first_name or "there"):
            c = sqlite3.connect(DB_PATH)
            c.execute("UPDATE users SET winback_email_sent_at=? WHERE id=?",
                      (datetime.now().isoformat(), user_id))
            c.commit(); c.close()
            print(f"[Winback] Sent to user_id={user_id} ({email})")

async def _lifecycle_email_loop():
    await asyncio.sleep(60 * 60)
    while True:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_lifecycle_emails)
        await asyncio.sleep(60 * 60)

@app.on_event("startup")
async def _startup():
    asyncio.create_task(_subscription_checker_loop())
    asyncio.create_task(_lifecycle_email_loop())

def _paypal_token():
    res = requests.post(
        f"{PAYPAL_BASE}/v1/oauth2/token",
        auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET),
        data={"grant_type": "client_credentials"},
        timeout=10
    )
    res.raise_for_status()
    return res.json()["access_token"]

@app.post("/api/create-checkout-session")
async def create_checkout_session(data: dict):
    user_id   = data.get("user_id")
    plan_type = data.get("plan_type", "monthly")
    if not PAYPAL_CLIENT_ID or not PAYPAL_PLAN_ID:
        raise HTTPException(status_code=503, detail="Payments not configured")
    plan_id = PAYPAL_PLAN_ID_YEARLY if plan_type == "yearly" and PAYPAL_PLAN_ID_YEARLY else PAYPAL_PLAN_ID
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT email FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        token = _paypal_token()
        res = requests.post(
            f"{PAYPAL_BASE}/v1/billing/subscriptions",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "plan_id": plan_id,
                "custom_id": str(user_id),
                "subscriber": {"email_address": row[0]},
                "application_context": {
                    "brand_name": "SultraxAI",
                    "user_action": "SUBSCRIBE_NOW",
                    "return_url": f"{APP_URL}/?payment=success&user_id={user_id}&plan_type={plan_type}",
                    "cancel_url": f"{APP_URL}/?payment=canceled",
                }
            },
            timeout=10
        )
        res.raise_for_status()
        resp = res.json()
        approval_url = next(l["href"] for l in resp["links"] if l["rel"] == "approve")
        return {"url": approval_url, "subscription_id": resp["id"], "plan_type": plan_type}
    except Exception as e:
        print(f"PayPal checkout error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/verify-payment")
async def verify_payment(data: dict):
    user_id         = data.get("user_id")
    subscription_id = data.get("subscription_id")
    plan_type       = data.get("plan_type", "monthly")
    if not PAYPAL_CLIENT_ID or not subscription_id:
        raise HTTPException(status_code=503, detail="Payments not configured")
    try:
        token = _paypal_token()
        res = requests.get(
            f"{PAYPAL_BASE}/v1/billing/subscriptions/{subscription_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        res.raise_for_status()
        sub = res.json()
        active = sub.get("status") in ("ACTIVE", "TRIALING", "APPROVED")
        if active:
            next_billing = (sub.get("billing_info") or {}).get("next_billing_time", "")
            start_time   = sub.get("start_time", datetime.now(timezone.utc).isoformat())
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET subscription_status='active', stripe_customer_id=?, subscription_plan=?, subscription_expires=?, subscription_start=?, subscription_cancel_pending=0 WHERE id=?",
                (subscription_id, plan_type, next_billing, start_time, user_id)
            )
            conn.commit()
            conn.close()
            print(f"PayPal activated: user={user_id} plan={plan_type} expires={next_billing}")
        return {"status": "active" if active else "pending"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/cancel-subscription")
async def cancel_subscription(data: dict):
    user_id = data.get("user_id")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT stripe_customer_id, subscription_expires FROM users WHERE id=?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="No active PayPal subscription found")
    sub_id, expires = row
    try:
        token = _paypal_token()
        res = requests.post(
            f"{PAYPAL_BASE}/v1/billing/subscriptions/{sub_id}/cancel",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"reason": "Cancelled by user"},
            timeout=10
        )
        # 204 = success, 422 = already cancelled — both are acceptable
        if res.status_code not in (200, 204, 422):
            raise Exception(f"PayPal returned {res.status_code}: {res.text}")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Could not reach PayPal: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET subscription_cancel_pending=1 WHERE id=?", (user_id,))
    conn.commit()
    conn.close()
    print(f"[Cancel] user={user_id} cancelled, access until {expires}")
    return {"status": "cancelled", "access_until": expires or ""}

@app.post("/api/admin/grant-subscription")
async def admin_grant_subscription(request: Request, data: dict):
    _admin_auth(request)
    user_id = data.get("user_id")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET subscription_status = 'active' WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.get("/api/admin/blocked-words")
async def admin_get_blocked_words(request: Request):
    _admin_auth(request)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT word, added_at FROM chat_blocked_words ORDER BY added_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return {"words": [{"word": r[0], "added_at": r[1]} for r in rows]}

@app.post("/api/admin/blocked-words")
async def admin_add_blocked_word(request: Request, data: dict):
    _admin_auth(request)
    word = (data.get("word") or "").strip().lower()
    if not word:
        return JSONResponse(status_code=400, content={"detail": "Word is required"})
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO chat_blocked_words (word, added_at) VALUES (?, ?)",
                       (word, datetime.now().isoformat()))
        conn.commit()
    except Exception:
        conn.close()
        return JSONResponse(status_code=400, content={"detail": "Word already exists"})
    conn.close()
    global _custom_words_cache_ts
    _custom_words_cache_ts = 0.0
    return {"status": "ok", "word": word}

@app.get("/api/admin/chat-messages")
async def admin_get_chat_messages(request: Request, room: str = "crypto", limit: int = 50):
    _admin_auth(request)
    room = room if room in ("crypto", "stocks") else "crypto"
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, user_id, first_name, message, created_at FROM chat_messages WHERE room=? ORDER BY id DESC LIMIT ?",
        (room, min(limit, 200))
    )
    rows = cursor.fetchall()
    conn.close()
    return {"messages": [{"id": r[0], "user_id": r[1], "username": r[2], "message": r[3], "created_at": r[4]} for r in rows]}

@app.delete("/api/admin/chat-messages/{message_id}")
async def admin_delete_chat_message(message_id: int, request: Request):
    _admin_auth(request)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_messages WHERE id = ?", (message_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.delete("/api/admin/blocked-words/{word}")
async def admin_delete_blocked_word(word: str, request: Request):
    _admin_auth(request)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_blocked_words WHERE word = ?", (word.lower(),))
    conn.commit()
    conn.close()
    global _custom_words_cache_ts
    _custom_words_cache_ts = 0.0
    return {"status": "ok"}

@app.get("/api/admin/username-blocked-words")
async def admin_get_username_blocked_words(request: Request):
    _admin_auth(request)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT word, added_at FROM username_blocked_words ORDER BY added_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return {"words": [{"word": r[0], "added_at": r[1]} for r in rows]}

@app.post("/api/admin/username-blocked-words")
async def admin_add_username_blocked_word(request: Request, data: dict):
    _admin_auth(request)
    word = (data.get("word") or "").strip().lower()
    if not word:
        return JSONResponse(status_code=400, content={"detail": "Word is required"})
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO username_blocked_words (word, added_at) VALUES (?, ?)",
                       (word, datetime.now().isoformat()))
        conn.commit()
    except Exception:
        conn.close()
        return JSONResponse(status_code=400, content={"detail": "Word already exists"})
    conn.close()
    global _custom_username_words_cache_ts
    _custom_username_words_cache_ts = 0.0
    return {"status": "ok", "word": word}

@app.delete("/api/admin/username-blocked-words/{word}")
async def admin_delete_username_blocked_word(word: str, request: Request):
    _admin_auth(request)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM username_blocked_words WHERE word = ?", (word.lower(),))
    conn.commit()
    conn.close()
    global _custom_username_words_cache_ts
    _custom_username_words_cache_ts = 0.0
    return {"status": "ok"}

# ─── HEARTBEAT / ACTIVE USERS ─────────────────────────────────────────────────

class HeartbeatData(BaseModel):
    user_id: int
    session_token: str = ""

def _geolocate(ip: str) -> dict:
    """Return {country, country_code} for an IP. Cached. Falls back to unknown."""
    if ip in _ip_geo_cache:
        return _ip_geo_cache[ip]
    if not ip or ip in ("127.0.0.1", "::1"):
        return {"country": "Local", "country_code": "??"}
    try:
        r = requests.get(f"http://ip-api.com/json/{ip}?fields=country,countryCode",
                         timeout=3)
        if r.status_code == 200:
            d = r.json()
            result = {"country": d.get("country", "Unknown"),
                      "country_code": d.get("countryCode", "??")}
            _ip_geo_cache[ip] = result
            return result
    except Exception:
        pass
    return {"country": "Unknown", "country_code": "??"}

@app.post("/api/heartbeat")
async def heartbeat(data: HeartbeatData, request: Request):
    import time

    if data.session_token:
        conn = sqlite3.connect(DB_PATH)
        row = conn.execute("SELECT session_token FROM users WHERE id=?", (data.user_id,)).fetchone()
        conn.close()
        if row and row[0] and row[0] != data.session_token:
            return JSONResponse(status_code=401, content={"detail": "session_replaced"})

    # Geolocate in thread so it doesn't block the event loop
    client_ip = request.headers.get("x-forwarded-for", request.client.host).split(",")[0].strip()
    loop = asyncio.get_event_loop()
    geo = await loop.run_in_executor(None, _geolocate, client_ip)

    now = time.time()
    _active_sessions[data.user_id] = {
        "last_seen": now,
        "country": geo["country"],
        "country_code": geo["country_code"],
    }
    cutoff = now - 600
    stale = [uid for uid, info in _active_sessions.items() if info["last_seen"] < cutoff]
    for uid in stale:
        del _active_sessions[uid]
    return {"status": "ok"}

@app.post("/api/accept-chat-terms")
async def accept_chat_terms(request: Request, data: dict):
    user_id = data.get("user_id")
    session_token = data.get("session_token", "")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    _validate_session(user_id, session_token)
    ip = get_remote_address(request)
    accepted_at = datetime.now(timezone.utc).isoformat()
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "UPDATE users SET chat_terms_accepted_at=?, chat_terms_accepted_ip=? WHERE id=?",
        (accepted_at, ip, user_id)
    )
    conn.commit()
    conn.close()
    print(f"[ChatTerms] user_id={user_id} accepted at {accepted_at} from {ip}")
    return {"status": "ok", "accepted_at": accepted_at}

@app.post("/api/logout")
async def logout(user_id: int):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("UPDATE users SET session_token=NULL WHERE id=?", (user_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.get("/api/admin/stats")
async def admin_stats(request: Request):
    import time
    _admin_auth(request)
    now = time.time()
    sessions_5m  = [s for s in _active_sessions.values() if now - s["last_seen"] < 300]
    sessions_15m = [s for s in _active_sessions.values() if now - s["last_seen"] < 900]
    country_counts: dict[str, dict] = {}
    for s in sessions_15m:
        cc = s["country_code"]
        if cc not in country_counts:
            country_counts[cc] = {"country": s["country"], "count": 0}
        country_counts[cc]["count"] += 1
    return {
        "online_5m": len(sessions_5m),
        "online_15m": len(sessions_15m),
        "countries": country_counts,
    }

# ─── COMMUNITY CHAT ───────────────────────────────────────────────────────────

class _ChatManager:
    def __init__(self):
        self.rooms: dict[str, list[WebSocket]] = {"crypto": [], "stocks": []}

    async def connect(self, ws: WebSocket, room: str):
        await ws.accept()
        self.rooms.setdefault(room, []).append(ws)

    def disconnect(self, ws: WebSocket, room: str):
        self.rooms[room] = [c for c in self.rooms.get(room, []) if c is not ws]

    async def broadcast(self, msg: dict, room: str):
        dead = []
        for ws in self.rooms.get(room, []):
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, room)

chat_manager = _ChatManager()

def _chat_history(room: str, limit=20):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, user_id, first_name, message, created_at FROM chat_messages WHERE room=? ORDER BY id DESC LIMIT ?",
        (room, limit)
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "user_id": r[1], "first_name": r[2], "message": r[3], "created_at": r[4]}
            for r in reversed(rows)]

def _chat_save(user_id, first_name, message, room):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute(
        "INSERT INTO chat_messages (user_id, first_name, message, created_at, room) VALUES (?,?,?,?,?)",
        (user_id, first_name, message, now, room)
    )
    msg_id = cursor.lastrowid
    cursor.execute("DELETE FROM chat_messages WHERE id NOT IN (SELECT id FROM chat_messages ORDER BY id DESC LIMIT 1000)")
    conn.commit()
    conn.close()
    return msg_id, now

@app.websocket("/ws/chat")
async def chat_ws(ws: WebSocket, user_id: int = 0, room: str = "crypto"):
    room = room if room in ("crypto", "stocks") else "crypto"
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT username, first_name FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    display_name = (row[0] or row[1] or "User") if row else "User"
    await chat_manager.connect(ws, room)
    try:
        await ws.send_json({"type": "history", "messages": _chat_history(room)})
        while True:
            data = await ws.receive_json()
            text = (data.get("message") or "").strip()[:500]
            if not text:
                continue
            err = _moderate_chat(user_id, text)
            if err:
                await ws.send_json({"type": "error", "message": err})
                continue
            msg_id, ts = _chat_save(user_id, display_name, text, room)
            await chat_manager.broadcast({
                "type": "message",
                "id": msg_id,
                "user_id": user_id,
                "first_name": display_name,
                "message": text,
                "created_at": ts,
                "room": room,
            }, room)
    except WebSocketDisconnect:
        chat_manager.disconnect(ws, room)
    except Exception:
        chat_manager.disconnect(ws, room)

dist_path = "/root/sultraxai/sultraxai-frontend/dist"
if os.path.exists(dist_path):
    app.mount("/assets", StaticFiles(directory=f"{dist_path}/assets", html=False), name="assets")

    @app.middleware("http")
    async def add_cache_headers(request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response
    @app.get("/{catchall:path}")
    async def serve_react(catchall: str):
        if catchall.startswith("api"): 
            raise HTTPException(status_code=404)
        
        # יצירת ה-Response עם כותרות למניעת Caching
        response = FileResponse(f"{dist_path}/index.html")
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
