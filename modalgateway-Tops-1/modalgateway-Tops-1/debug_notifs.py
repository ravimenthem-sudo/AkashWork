import os
import requests
from dotenv import load_dotenv

load_dotenv()
user_id = "6606d1df-dfb7-40f3-9a68-09f1170d90c5"
url = f"{os.getenv('SUPABASE_URL')}/rest/v1/notifications?receiver_id=eq.{user_id}&select=*"
headers = {
    "apikey": os.getenv("SUPABASE_KEY"),
    "Authorization": f"Bearer {os.getenv('SUPABASE_KEY')}"
}
resp = requests.get(url, headers=headers)
print(resp.json())
