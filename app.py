import streamlit as st
import pandas as pd
import psycopg2

st.title("SultraxAI - Whale Monitor 🐋")

# חיבור ל-DB
conn = psycopg2.connect(dbname="sultrax_db", user="postgres", host="localhost")
df = pd.read_sql_query("SELECT * FROM anomalies ORDER BY timestamp DESC", conn)

# תצוגה
st.write("Recent Market Anomalies")
st.dataframe(df) # מציג טבלה אינטראקטיבית
