import sqlite3
import streamlit as st
import pandas as pd
from datetime import datetime, timedelta

DB_PATH = "/root/sultraxai/sultraxai.db"

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
                    <div class="row-bottom" style="margin-top: 6px;">
                        <span>Z-Score: <span style="color:#E5E7EB;">{row['z_score']:.2f}</span></span>
                        <span>Volume Executed: <span class="value-mono">{vol}</span></span>
                    </div>
                </div>
            """, unsafe_allow_html=True)

if st.button("SYNC", type="primary", use_container_width=True): st.rerun()
