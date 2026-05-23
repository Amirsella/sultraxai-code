import sqlite3
import hashlib
import os
import random
import uuid
import requests
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
import uvicorn

BREVO_API_KEY = "YOUR_BREVO_API_KEY"
FINNHUB_KEY = "FINNHUB_API_KEY"
APP_URL = "http://38.180.137.122:8000"

verification_codes = {}
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
            first_name TEXT, full_name TEXT, email TEXT UNIQUE, phone TEXT UNIQUE, password_hash TEXT
        )
    """)
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
    email = data.get('email')
    code = data.get('code')
    if verification_codes.get(email) == code:
        del verification_codes[email]
        return {"status": "success"}
    
    return JSONResponse(status_code=400, content={"detail": "Invalid code"})

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
    cursor.execute("SELECT id FROM users WHERE email = ? OR phone = ?", (user.email.strip(), user.phone.strip()))
    if cursor.fetchone():
        conn.close()
        return JSONResponse(status_code=400, content={"detail": "User already exists"})

    code = str(random.randint(100000, 999999))
    verification_codes[user.email.strip()] = code
    background_tasks.add_task(send_verification_email, user.email.strip(), code)

    pwd_hash = hash_password(user.password)
    cursor.execute("INSERT INTO users (first_name, full_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)",
                   (user.first_name, user.full_name, user.email.strip(), user.phone.strip(), pwd_hash))
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
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
    cursor.execute("SELECT first_name, full_name, email, phone FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return JSONResponse(status_code=404, content={"detail": "User not found"})
    cursor.execute("SELECT experience, frequency FROM user_profiles WHERE user_id = ?", (user_id,))
    profile = cursor.fetchone()
    conn.close()
    return {
        "first_name": row[0], "full_name": row[1], "email": row[2], "phone": row[3],
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
        res = requests.get(f"https://api.stocktwits.com/api/2/streams/symbol/{st_sym}.json",
            headers={"User-Agent": "SultraxAI/1.0"}, timeout=5)
        msgs = res.json().get("messages", [])[:20]
        return [{"text": m.get("body",""), "user": m.get("user",{}).get("username",""),
                 "sentiment": m.get("entities",{}).get("sentiment",{}).get("basic",""),
                 "likes": m.get("likes",{}).get("total",0), "time": m.get("created_at","")}
                for m in msgs if m.get("body")]
    except Exception as e:
        print(f"Zone StockTwits error: {e}"); return []

def _zone_reddit(symbol: str) -> list:
    try:
        ticker = symbol.replace('-USD','').replace('/','').split('.')[0]
        subs = "stocks+wallstreetbets+investing+CryptoCurrency" if '-USD' in symbol else "stocks+wallstreetbets+investing"
        res = requests.get(f"https://www.reddit.com/r/{subs}/search.json",
            params={"q": ticker, "sort": "new", "restrict_sr": "1", "limit": "15", "type": "link"},
            headers={"User-Agent": "SultraxAI/1.0"}, timeout=5)
        posts = res.json().get("data",{}).get("children",[])
        return [{"title": p["data"].get("title",""), "subreddit": p["data"].get("subreddit",""),
                 "score": p["data"].get("score",0), "comments": p["data"].get("num_comments",0),
                 "url": "https://reddit.com" + p["data"].get("permalink",""),
                 "time": p["data"].get("created_utc",0)}
                for p in posts if p.get("data",{}).get("title")][:12]
    except Exception as e:
        print(f"Zone Reddit error: {e}"); return []

@app.get("/api/zone/all")
async def get_zone_all(symbol: str):
    with ThreadPoolExecutor(max_workers=3) as ex:
        nf = ex.submit(_zone_news, symbol)
        sf = ex.submit(_zone_stocktwits, symbol)
        rf = ex.submit(_zone_reddit, symbol)
        news, twits, reddit = nf.result(), sf.result(), rf.result()
    bull = sum(1 for m in twits if m.get("sentiment") == "Bullish")
    bear = sum(1 for m in twits if m.get("sentiment") == "Bearish")
    total = bull + bear
    return {"symbol": symbol, "news": news, "stocktwits": twits, "reddit": reddit,
            "sentiment": {"bull": bull, "bear": bear, "pct": round(bull/total*100) if total else 50}}

@app.post("/api/login")
async def login(user: UserLogin):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    email_clean = user.email.strip().lower()
    cursor.execute("SELECT id, first_name, password_hash FROM users WHERE LOWER(email) = ?", (email_clean,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return JSONResponse(status_code=401, content={"detail": "User not found"})
    
    user_id, first_name, stored_pwd_hash = row
    pwd_hash = hash_password(user.password)
    
    print(f"Login attempt for: {email_clean}")
    print(f"DB Hash: {stored_pwd_hash}")
    print(f"Calc Hash: {pwd_hash}")

    if stored_pwd_hash != pwd_hash:
        conn.close()
        return JSONResponse(status_code=401, content={"detail": "Wrong password"})
    
    cursor.execute("SELECT experience FROM user_profiles WHERE user_id = ?", (user_id,))
    has_profile = cursor.fetchone() is not None
    cursor.execute("SELECT symbol FROM user_assets WHERE user_id = ?", (user_id,))
    assets = [r[0] for r in cursor.fetchall()]
    conn.close()
    
    return {"user_id": user_id, "first_name": first_name, "onboarding_completed": has_profile, "assets": assets}

    
dist_path = "/root/sultraxai/sultraxai-frontend/dist"
if os.path.exists(dist_path):
    app.mount("/assets", StaticFiles(directory=f"{dist_path}/assets"), name="assets")
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
