import requests
import time


TOKEN = "8251083838:AAEYkdUqqF-XXtPlrvNgD2XQ_0TvUwT7x18"

print("SultraxAI: Waiting for your message in Telegram...")
print("Please go to your bot and send any message now.")

url = f"https://api.telegram.org/bot{TOKEN}/getUpdates"

while True:
    try:
        response = requests.get(url).json()
        if response["result"]:
            last_msg = response["result"][-1]
            chat_id = last_msg["message"]["chat"]["id"]
            name = last_msg["message"]["chat"]["first_name"]
            print(f"\n✅ נמצא! ה-Chat ID של {name} הוא: {chat_id}")
            break
        else:
            print(".", end="", flush=True) # מדפיס נקודות בזמן המתנה
            time.sleep(2)
    except Exception as e:
        print(f"\n❌ שגיאה: {e}")
        break