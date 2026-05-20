import sqlite3
import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
import smtplib
import random
from email.mime.text import MIMEText

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_verified INTEGER DEFAULT 0,
        verification_code TEXT,
        code_expires_at DATETIME
    )
    ''')
    conn.commit()
    conn.close()

def send_verification_email(user_email, code):
    sender_email = "YOUR_GMAIL@gmail.com"  # כאן תשים את המייל שלך בהמשך
    sender_password = "YOUR_APP_PASSWORD" # סיסמת אפליקציה של גוגל
    
    msg = MIMEText(f"קוד האימות שלך ל-SultraxAI הוא: {code}\nהקוד תקף ל-15 דקות הקרובות.")
    msg['Subject'] = 'SultraxAI - קוד אימות משתמש'
    msg['From'] = sender_email
    msg['To'] = user_email
    
    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, user_email, msg.as_string())
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False
DB_PATH = "/root/sultraxai/sultraxai.db"
init_db()
def get_israel_time():
    return datetime.utcnow() + timedelta(hours=3)

st.set_page_config(page_title="SultraxAI Terminal", layout="wide", initial_sidebar_state="collapsed")

st.markdown("""
    <style>
    /* איפוס פרימיום אמיתי - רקע שחור עמוק כמעט מוחלט */
    .stApp { background-color: #070709 !important; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    
    /* העלמה אגרסיבית של כל סממן סטרימליט */
    header[data-testid="stHeader"], .stDeployButton, #MainMenu, footer { display: none !important; visibility: hidden !important; }
    
    /* שוליים מדויקים - נצמד למעלה אבל נושם */
    .main .block-container { padding: 2rem 3rem !important; max-width: 100% !important; }
    
    /* Header מינימליסטי מושחז */
    .pro-header {
        display: flex; justify-content: space-between; align-items: center;
        border-bottom: 1px solid #1A1A24; padding-bottom: 1rem; margin-bottom: 2rem;
    }
    .pro-logo { font-size: 1.2rem; font-weight: 800; letter-spacing: 4px; color: #FFFFFF; text-transform: uppercase; }
    .pro-logo span { color: #E53935; } /* אדום פחות צועק, יותר מקצועי */
    .pro-status { font-size: 0.75rem; letter-spacing: 1px; color: #9CA3AF; display: flex; align-items: center; gap: 8px; }
    .dot { height: 6px; width: 6px; background-color: #10B981; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #10B981; }
    
    /* יישור עמודות */
    [data-testid="stHorizontalBlock"] { display: flex !important; flex-direction: row-reverse !important; gap: 3rem !important; }
    
    /* כותרות סקשנים נקיות */
    .clean-title { font-size: 0.8rem; font-weight: 600; color: #6B7280; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 1rem; border-bottom: 1px solid #1A1A24; padding-bottom: 0.5rem; }
    
    /* כרטיסים שטוחים ללא גבולות מוגזמים */
    .data-row { background-color: transparent; border-bottom: 1px solid #14141C; padding: 1rem 0; transition: background-color 0.2s ease; }
    .data-row:hover { background-color: #0B0B0F; }
    
    .row-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.2rem; }
    .row-bottom { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #6B7280; }
    
    .ticker { font-size: 1rem; font-weight: 700; color: #E5E7EB; letter-spacing: 1px; }
    .value-mono { font-family: 'Courier New', Courier, monospace; font-size: 1rem; font-weight: 600; color: #FFFFFF; }
    
    .tag-red { color: #E53935; font-weight: 600; font-family: 'Courier New', Courier, monospace; }
    .tag-green { color: #10B981; font-weight: 600; font-family: 'Courier New', Courier, monospace; }
    .alert-label { font-size: 0.7rem; color: #E53935; border: 1px solid #E53935; padding: 2px 6px; border-radius: 3px; letter-spacing: 1px; }
    </style>
""", unsafe_allow_html=True)

st.markdown("""
    <div class="pro-header">
        <div class="pro-logo">Sultrax<span>AI</span></div>
        <div class="pro-status">SYSTEM ACTIVE <span class="dot"></span></div>
    </div>
""", unsafe_allow_html=True)

try:
    conn = sqlite3.connect(DB_PATH)
    one_hour_ago = (get_israel_time() - timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')
    df_alerts = pd.read_sql_query("SELECT timestamp, symbol, z_score, value_usd FROM user_alerts WHERE user_id = 1 AND timestamp > ? ORDER BY timestamp DESC", conn, params=(one_hour_ago,))
    df_watchlist = pd.read_sql_query("SELECT symbol, price, price_change FROM anomalies WHERE id IN (SELECT MAX(id) FROM anomalies GROUP BY symbol) ORDER BY symbol ASC", conn)
    conn.close()
except:
    df_alerts = df_watchlist = pd.DataFrame()

# ניהול מצבי מסכים (session_state)
if "app_step" not in st.session_state:
    st.session_state.app_step = "register"  # שלב התחלתי: הרשמה

# ----------------- מסך 1: טופס הרשמה -----------------
if st.session_state.app_step == "register":
    st.markdown("<div class='clean-title'>Create Account</div>", unsafe_allow_html=True)
    
    with st.form("registration_form"):
        new_user = st.text_input("Username")
        new_email = st.text_input("Email Address")
        new_pass = st.text_input("Password", type="password")
        submit_reg = st.form_submit_button("Sign Up", use_container_width=True)
        
        if submit_reg:
            if new_user and new_email and new_pass:
                # יצירת קוד אקראי וזמן תפוגה (15 דקות מהרגע)
                v_code = str(random.randint(100000, 999999))
                expires_at = (datetime.now() + timedelta(minutes=15)).strftime('%Y-%m-%d %H:%M:%S')
                
                try:
                    conn_reg = sqlite3.connect(DB_PATH)
                    cursor_reg = conn_reg.cursor()
                    
                    # שמירת המשתמש כלא מאומת (is_verified = 0)
                    cursor_reg.execute('''
                        INSERT INTO users (username, email, password, is_verified, verification_code, code_expires_at)
                        VALUES (?, ?, ?, 0, ?, ?)
                    ''', (new_user, new_email, new_pass, v_code, expires_at))
                    
                    conn_reg.commit()
                    conn_reg.close()
                    
                    # שליחת המייל (כרגע מוגדר עם ערכי דמה, ישתמש בפונקציה שיצרנו למעלה)
                    send_verification_email(new_email, v_code)
                    
                    # שמירת המייל בזיכרון ומעבר למסך האימות
                    st.session_state.temp_email = new_email
                    st.session_state.app_step = "verify"
                    st.success("Verification code sent to your email!")
                    st.rerun()
                    
                except sqlite3.IntegrityError:
                    st.error("Username or Email already exists.")
            else:
                st.error("Please fill out all fields.")

# ----------------- מסך 2: אימות קוד מהמייל -----------------
elif st.session_state.app_step == "verify":
    st.markdown("<div class='clean-title'>Email Verification</div>", unsafe_allow_html=True)
    st.info(f"Enter the 6-digit code sent to: {st.session_state.get('temp_email', '')}")
    
    code_input = st.text_input("Verification Code", max_chars=6)
    submit_verify = st.button("Verify & Continue", type="primary", use_container_width=True)
    
    if submit_verify:
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        conn_ver = sqlite3.connect(DB_PATH)
        cursor_ver = conn_ver.cursor()
        
        # שליפת נתוני הקוד של המשתמש
        cursor_ver.execute('''
            SELECT verification_code, code_expires_at FROM users 
            WHERE email = ? AND is_verified = 0
        ''', (st.session_state.get('temp_email'),))
        
        result = cursor_ver.fetchone()
        
        if result:
            db_code, db_expires = result
            # בדיקה אם הקוד נכון ואם לא עברו 15 דקות
            if code_input == db_code and current_time <= db_expires:
                cursor_ver.execute('UPDATE users SET is_verified = 1 WHERE email = ?', (st.session_state.get('temp_email'),))
                conn_ver.commit()
                
                # מעבר למסך הטרמינל הסופי!
                st.session_state.app_step = "terminal"
                st.success("Account verified successfully!")
                conn_ver.close()
                st.rerun()
            else:
                st.error("Invalid code or code has expired (15 min limit).")
        else:
            st.error("User session not found.")
        conn_ver.close()

# ----------------- מסך 3: הטרמינל המקורי שלך -----------------
elif st.session_state.app_step == "terminal":
    col_watchlist, col_alerts = st.columns([0.3, 0.7])

    with col_watchlist:
        st.markdown("<div class='clean-title'>Market Watchlist</div>", unsafe_allow_html=True)
        if df_watchlist.empty:
            stocks_data = [{"symbol": "AAPL", "price": 175.50, "change": 1.2}, {"symbol": "GOOGL", "price": 150.10, "change": 0.8}, {"symbol": "NVDA", "price": 900.00, "change": -1.4}]
        else:
            stocks_data = df_watchlist.to_dict('records')
            for s in stocks_data: s['change'] = s.get('price_change', 0)

        for stock in stocks_data:
            color_class = "tag-green" if stock['change'] >= 0 else "tag-red"
            sign = "+" if stock['change'] >= 0 else ""
            st.markdown(f"""
                <div class="data-row">
                    <div class="row-top"><span class="ticker">{stock['symbol']}</span><span class="value-mono">${stock['price']:.2f}</span></div>
                    <div class="row-bottom"><span>Daily Action</span><span class="{color_class}">{sign}{stock['change']}%</span></div>
                </div>
            """, unsafe_allow_html=True)

    with col_alerts:
        st.markdown("<div class='clean-title'>Live Order Flow Anomalies</div>", unsafe_allow_html=True)
        if df_alerts.empty:
            st.markdown("<div style='color: #4B5563; font-size: 0.9rem; margin-top: 1rem;'>Monitoring endpoints. No deviations detected.</div>", unsafe_allow_html=True)
        else:
            for _, row in df_alerts.iterrows():
                vol = f"${row['value_usd'] / 1_000_000:.1f}M" if row['value_usd'] >= 1_000_000 else f"${row['value_usd']:,}"
                time_str = row['timestamp'].split(" ")[1] if " " in row['timestamp'] else row['timestamp']
                st.markdown(f"""
                    <div class="data-row">
                        <div class="row-top">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span class="alert-label">VOL_SPIKE</span>
                                <span class="ticker">{row['symbol']}</span>
                            </div>
                            <span style="color: #6B7280; font-size: 0.8rem;">{time_str}</span>
                        </div>
                        <span class="row-bottom" style="margin-top: 6px;">
                            <span>Z-Score: <span style="color:#E5E7EB;">{row['z_score']:.2f}</span></span>
                            <span>Volume Executed: <span class="value-mono">{vol}</span></span>
                        </span>
                    </div>
                """, unsafe_allow_html=True)

    if st.button("SYNC", type="primary", use_container_width=True): st.rerun()