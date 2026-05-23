import sqlite3
import hashlib
import os
import smtplib
import random
from email.mime.text import MIMEText
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
import uvicorn

GMAIL_USER = "sultraxai@gmail.com"
GMAIL_APP_PASSWORD = "gfzd sgvn ktik hfkg"

verification_codes = {}

def send_verification_email(to_email: str, code: str) -> bool:
    msg = MIMEText(f"Your SultraxAI verification code is: <strong>{code}</strong><br>Valid for 15 minutes.", "html")
    msg["Subject"] = "SultraxAI - Verification Code"
    msg["From"] = GMAIL_USER
    msg["To"] = to_email
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())
        return True
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
    conn.commit()
    conn.close()

init_db()

class UserRegister(BaseModel):
    first_name: str; full_name: str; email: EmailStr; phone: str; password: str

@app.post("/api/verify-code")
async def verify_code(data: dict):
    email = data.get('email')
    code = data.get('code')
    if verification_codes.get(email) == code:
        del verification_codes[email]
        return {"status": "success"}
    
    return JSONResponse(status_code=400, content={"detail": "Invalid code"})
class OnboardingData(BaseModel):
    user_id: int; assets: list; experience: str; frequency: str

class UserLogin(BaseModel):
    email: str; password: str

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

@app.post("/api/register")
async def register(user: UserRegister):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ? OR phone = ?", (user.email.strip(), user.phone.strip()))
    if cursor.fetchone():
        conn.close()
        return JSONResponse(status_code=400, content={"detail": "User already exists"})
    
    code = str(random.randint(100000, 999999))
    verification_codes[user.email.strip()] = code
    send_verification_email(user.email.strip(), code)

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

@app.post("/api/login")
async def login(user: UserLogin):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    email_clean = user.email.strip()
    cursor.execute("SELECT id, first_name, password_hash FROM users WHERE email = ?", (email_clean,))
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
