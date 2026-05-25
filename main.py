import sqlite3
import hashlib
import os
import random
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
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
import uvicorn

BREVO_API_KEY      = os.environ.get("BREVO_API_KEY", "")
FINNHUB_KEY        = os.environ.get("FINNHUB_KEY", "")
GROQ_KEY           = os.environ.get("GROQ_KEY", "")
PAYPAL_CLIENT_ID     = os.environ.get("PAYPAL_CLIENT_ID", "")
PAYPAL_CLIENT_SECRET = os.environ.get("PAYPAL_CLIENT_SECRET", "")
PAYPAL_PLAN_ID       = os.environ.get("PAYPAL_PLAN_ID", "")
PAYPAL_BASE          = "https://api-m.paypal.com"
APP_URL   = "http://38.180.137.122:8000"
ADMIN_KEY = "sultrax_admin_key_2026"

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
app = FastAPI()

# נתיב קבוע לבסיס הנתונים
DB_PATH = "/root/sultraxai/sultraxai-frontend/users.db"

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
    for _col in ["created_at TEXT", "subscription_status TEXT", "stripe_customer_id TEXT"]:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {_col}")
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
        CREATE TABLE IF NOT EXISTS verification_codes_db (
            email TEXT PRIMARY KEY,
            code TEXT,
            expiry REAL
        )
    """)
    conn.commit()
    conn.close()

init_db()

class UserRegister(BaseModel):
    first_name: str; full_name: str; email: EmailStr; phone: str; password: str

@app.get("/api/config")
async def get_config():
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
async def verify_code(data: dict):
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
async def forgot_password(data: dict, background_tasks: BackgroundTasks):
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
async def reset_password(data: dict):
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
    return hashlib.sha256(password.encode()).hexdigest()

@app.post("/api/register")
async def register(user: UserRegister, background_tasks: BackgroundTasks):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    email_clean = user.email.strip().lower()
    phone_clean = user.phone.strip()

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
        cursor.execute("INSERT INTO users (first_name, full_name, email, phone, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                       (user.first_name, user.full_name, email_clean, phone_clean or '', pwd_hash, datetime.now().isoformat()))
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

@app.post("/api/update-assets")
async def update_assets(data: UpdateAssets):
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
    cursor.execute("SELECT first_name, full_name, email, phone, subscription_status FROM users WHERE id = ?", (user_id,))
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
        "experience": profile[0] if profile else "Beginner (0-1 yrs)",
        "frequency": profile[1] if profile else "Daily"
    }

@app.post("/api/update-profile")
async def update_profile(data: dict):
    user_id = data.get("user_id")
    first_name = data.get("first_name", "").strip()
    full_name = data.get("full_name", "").strip()
    phone = data.get("phone", "").strip()
    experience = data.get("experience")
    frequency = data.get("frequency")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
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
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return JSONResponse(status_code=404, content={"detail": "User not found"})
    if row[0] != hash_password(current_password):
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

def _admin_auth(key: str):
    if key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")

@app.get("/api/admin/users")
async def admin_list_users(key: str = ""):
    _admin_auth(key)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.first_name, u.full_name, u.email, u.phone, u.created_at,
               u.subscription_status,
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
async def admin_delete_user(user_id: int, key: str = ""):
    _admin_auth(key)
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
async def login(user: UserLogin):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    email_clean = user.email.strip().lower()
    cursor.execute("SELECT id, first_name, password_hash, subscription_status, stripe_customer_id FROM users WHERE LOWER(email) = ?", (email_clean,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return JSONResponse(status_code=401, content={"detail": "User not found"})

    user_id, first_name, stored_pwd_hash, subscription_status, sub_id = row
    pwd_hash = hash_password(user.password)
    if stored_pwd_hash != pwd_hash:
        conn.close()
        return JSONResponse(status_code=401, content={"detail": "Wrong password"})

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
                paypal_status = res.json().get("status", "")
                if paypal_status not in ("ACTIVE", "TRIALING", "APPROVED"):
                    subscription_status = ''
                    cursor.execute("UPDATE users SET subscription_status='' WHERE id=?", (user_id,))
                    conn.commit()
                    print(f"[Login] user={user_id} sub revoked on login, PayPal status={paypal_status}")
        except Exception as e:
            print(f"[Login] PayPal check failed (non-blocking): {e}")

    conn.close()

    return {"user_id": user_id, "first_name": first_name, "onboarding_completed": has_profile,
            "assets": assets, "subscription_status": subscription_status or ""}

    
def _check_subscriptions_sync():
    if not PAYPAL_CLIENT_ID:
        return
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, stripe_customer_id FROM users "
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
    expired = []
    for user_id, sub_id in rows:
        try:
            res = requests.get(
                f"{PAYPAL_BASE}/v1/billing/subscriptions/{sub_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            if res.status_code == 200:
                status = res.json().get("status", "")
                if status not in ("ACTIVE", "TRIALING"):
                    expired.append(user_id)
                    print(f"[SubChecker] user={user_id} sub={sub_id} status={status} → revoked")
            else:
                print(f"[SubChecker] user={user_id} sub={sub_id} HTTP {res.status_code}")
        except Exception as e:
            print(f"[SubChecker] user={user_id} error: {e}")
    if expired:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        for uid in expired:
            cursor.execute("UPDATE users SET subscription_status='' WHERE id=?", (uid,))
        conn.commit()
        conn.close()
        print(f"[SubChecker] Revoked {len(expired)} subscription(s)")

async def _subscription_checker_loop():
    loop = asyncio.get_event_loop()
    while True:
        print("[SubChecker] Running daily subscription check...")
        await loop.run_in_executor(None, _check_subscriptions_sync)
        await asyncio.sleep(24 * 60 * 60)

@app.on_event("startup")
async def _startup():
    asyncio.create_task(_subscription_checker_loop())

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
    user_id = data.get("user_id")
    if not PAYPAL_CLIENT_ID or not PAYPAL_PLAN_ID:
        raise HTTPException(status_code=503, detail="Payments not configured")
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
                "plan_id": PAYPAL_PLAN_ID,
                "custom_id": str(user_id),
                "subscriber": {"email_address": row[0]},
                "application_context": {
                    "brand_name": "SultraxAI",
                    "user_action": "SUBSCRIBE_NOW",
                    "return_url": f"{APP_URL}/?payment=success&user_id={user_id}",
                    "cancel_url": f"{APP_URL}/?payment=canceled",
                }
            },
            timeout=10
        )
        res.raise_for_status()
        resp = res.json()
        approval_url = next(l["href"] for l in resp["links"] if l["rel"] == "approve")
        return {"url": approval_url, "subscription_id": resp["id"]}
    except Exception as e:
        print(f"PayPal checkout error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/verify-payment")
async def verify_payment(data: dict):
    user_id       = data.get("user_id")
    subscription_id = data.get("subscription_id")
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
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET subscription_status = 'active', stripe_customer_id = ? WHERE id = ?",
                           (subscription_id, user_id))
            conn.commit()
            conn.close()
            print(f"PayPal subscription activated: user_id={user_id}, sub={subscription_id}")
        return {"status": "active" if active else "pending"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/admin/grant-subscription")
async def admin_grant_subscription(data: dict, key: str = ""):
    _admin_auth(key)
    user_id = data.get("user_id")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET subscription_status = 'active' WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

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
