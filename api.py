from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
import sqlite3
import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta

app = FastAPI(title="SultraxAI Secure API Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# הגדרות אבטחה קריטיות
SECRET_KEY = "SUPER_SECRET_KEY_CHANGE_THIS_IN_PRODUCTION" # מפתח ההצפנה של הטוקנים
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

DB_PATH = "/root/sultraxai/sultraxai.db"

# הגדרת כלי הצפנת סיסמאות ומנגנון שליפת הטוקן
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

class SettingsUpdate(BaseModel):
    symbol: str
    min_z_score: float
    is_enabled: int

# --- פונקציות עזר לאבטחה ---

def verify_password(plain_password, hashed_password):
    """בודק אם הסיסמה שהוזנה מתאימה להאש המוצפן ב-DB"""
    # זמנית, כדי שלא תינעל מחוץ למערכת, נאפשר גם בדיקה של טקסט רגיל (password123)
    if plain_password == hashed_password:
        return True
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except:
        return False

def create_access_token(data: dict):
    """מייצר טוקן חתום דיגיטלית שתקף לזמן מוגבל"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user_id(token: str = Depends(oauth2_scheme)):
    """שומר הסף: מפענח את הטוקן, בודק אבטחה ומחלץ את ה-user_id של המשתמש הגולש"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return user_id
    except jwt.PyJWTError:
        raise credentials_exception

# --- נתיבי ה-API (Endpoints) ---

@app.get("/")
def home():
    return {"status": "online", "message": "SultraxAI Secure API is running"}

@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """נתיב התחברות: מקבל שם וסיסמה, ומחזיר את מפתח הגישה המאובטח (JWT)"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, password_hash FROM users WHERE username = ?", (form_data.username,))
    user = cursor.fetchone()
    conn.close()

    if not user or not verify_password(form_data.password, user[1]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="שם משתמש או סיסמה שגויים",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # יצירת הטוקן כשה-sub שלו הוא מזהה המשתמש (user_id)
    access_token = create_access_token(data={"sub": user[0]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/alerts")
def get_user_alerts(limit: int = 20, current_user_id: int = Depends(get_current_user_id)):
    """נתיב מאובטח: שולף את ההתראות אך ורק של המשתמש המחובר כעת"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT alert_id, timestamp, symbol, z_score, value_usd, price_change, status, is_read 
            FROM user_alerts 
            WHERE user_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        ''', (current_user_id, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        alerts = []
        for row in rows:
            alerts.append({
                "alert_id": row[0],
                "timestamp": row[1],
                "symbol": row[2],
                "z_score": round(row[3], 2),
                "value_usd": round(row[4], 2),
                "price_change": round(row[5], 2),
                "status": row[6],
                "is_read": row[7]
            })
        return {"user_id": current_user_id, "alerts": alerts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/settings/update")
def update_user_settings(settings: SettingsUpdate, current_user_id: int = Depends(get_current_user_id)):
    """נתיב מאובטח: מעדכן הגדרות מניות אך ורק עבור המשתמש שביצע את הפעולה"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO user_settings (user_id, symbol, min_z_score, is_enabled)
            VALUES (?, ?, ?, ?)
        ''', (current_user_id, settings.symbol.upper(), settings.min_z_score, settings.is_enabled))
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Settings for {settings.symbol} updated for user {current_user_id}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))