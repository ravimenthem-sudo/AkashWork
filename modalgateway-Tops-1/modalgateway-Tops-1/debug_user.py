import os
import requests
from dotenv import load_dotenv

load_dotenv()
url = f"{os.getenv('SUPABASE_URL')}/rest/v1/profiles?full_name=ilike.*Menthem*&select=id,full_name"
headers = {
    "apikey": os.getenv("SUPABASE_KEY"),
    "Authorization": f"Bearer {os.getenv('SUPABASE_KEY')}"
}
resp = requests.get(url, headers=headers)
print(resp.json())
