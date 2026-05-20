import sqlite3
import time
import requests
from datetime import datetime, timedelta

# הגדרת נתיבים ומשתנים גלובליים
DB_PATH = "/root/sultraxai/sultraxai.db"

def get_israel_time():
    """מחזירה את הזמן הנוכחי בישראל (UTC + 3)"""
    return datetime.utcnow() + timedelta(hours=3)

def save_to_db(symbol, event_type, z_score, value_usd, price_change, price):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # שימוש בשעון ישראל עבור ה-Timestamp של האנומליה
        israel_now_str = get_israel_time().strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute('''
            INSERT INTO anomalies (timestamp, symbol, event_type, z_score, value_usd, price_change, price)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (israel_now_str, symbol, event_type, z_score, value_usd, price_change, price))
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"DB Error (anomalies): {e}")

def get_recent_context(symbol):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # חישוב שעה אחת אחורה לפי שעון ישראל
        one_hour_ago = (get_israel_time() - timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute('SELECT event_type FROM anomalies WHERE symbol = ? AND timestamp > ?', (symbol, one_hour_ago))
        results = cursor.fetchall()
        conn.close()
        
        if not results:
            return "📍 אירוע נקודתי - לא זוהתה פעילות נוספת בשעה האחרונה."
        return f"🔄 חריגה חוזרת: זו החריגה ה-{len(results)+1} בשעה האחרונה."
    except Exception as e:
        print(f"DB Error (context): {e}")
        return "📍 לא ניתן לשלוף הקשר היסטורי."

def send_user_alerts(symbol, z_score, value_usd, price_change, price):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # שליפת משתמשים שעוקבים אחרי המניה הזו (יוזר 1 / admin)
        cursor.execute('SELECT user_id FROM users WHERE username = "admin"')
        matching_users = cursor.fetchall()
        
        israel_now_str = get_israel_time().strftime('%Y-%m-%d %H:%M:%S')
        
        for (user_id,) in matching_users:
            # תיקון QA: הזרקה נקייה רק של השדות שקיימים בטבלת user_alerts שלך
            cursor.execute('''
                INSERT INTO user_alerts (user_id, timestamp, symbol, z_score, is_read)
                VALUES (?, ?, ?, ?, 0)
            ''', (user_id, israel_now_str, symbol, z_score))
            print(f"✅ נשלחה התראה עבור {symbol}!")
            
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"DB Error (user_alerts): {e}")

def scan_market():
    # הדפסת כותרת הסריקה עם השעה המעודכנת של ישראל
    current_time_str = get_israel_time().strftime('%H:%M:%S')
    print(f"\n--- סריקת שוק פעילה: {current_time_str} ---")
    
    # סימולציה של נתוני שוק לצורך הבדיקה (AAPL, MSFT וכו')
    mock_data = [
        {"symbol": "AAPL", "volume": 452689, "z_score": 2.99, "value_usd": 78000000, "price_change": 1.2, "price": 175.5},
        {"symbol": "MSFT", "volume": 370090, "z_score": 1.52, "value_usd": 150000000, "price_change": -0.4, "price": 420.2},
        {"symbol": "GOOGL", "volume": 214902, "z_score": 2.25, "value_usd": 38000000, "price_change": 0.8, "price": 150.1},
        {"symbol": "AMZN", "volume": 392299, "z_score": 2.25, "value_usd": 72000000, "price_change": 1.5, "price": 178.4},
        {"symbol": "TSLA", "volume": 258192, "z_score": 1.62, "value_usd": 45000000, "price_change": -2.1, "price": 170.3},
        {"symbol": "NVDA", "volume": 1160328, "z_score": 1.43, "value_usd": 1050000000, "price_change": 3.4, "price": 900.0},
        {"symbol": "META", "volume": 101656, "z_score": 1.48, "value_usd": 48000000, "price_change": 0.1, "price": 475.2}
    ]
    
    for stock in mock_data:
        # פילטר: אם ה-Z-Score גבוה מ-2.0, זו אנומליה
        if stock["z_score"] > 2.0:
            print(f"[{stock['symbol']}] ווליום: {stock['volume']:,} | Z-Score: {stock['z_score']}")
            
            # שמירה לדטאבייס הכללי
            save_to_db(stock["symbol"], "VOLUME_SPIKE", stock["z_score"], stock["value_usd"], stock["price_change"], stock["price"])
            
            # שליחת התראה ליוזר admin (ייכנס לטבלת user_alerts)
            send_user_alerts(stock["symbol"], stock["z_score"], stock["value_usd"], stock["price_change"], stock["price"])
        else:
            print(f"[{stock['symbol']}] ווליום: {stock['volume']:,} | Z-Score: {stock['z_score']}")

if __name__ == "__main__":
    while True:
        try:
            scan_market()
            time.sleep(60)  # סריקה בכל דקה
        except KeyboardInterrupt:
            print("\nStopping SultraxAI Bot...")
            break
        except Exception as e:
            print(f"Loop Error: {e}")
            time.sleep(10)