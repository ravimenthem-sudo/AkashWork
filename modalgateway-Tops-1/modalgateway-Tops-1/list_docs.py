import os
import requests
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("TALENTOPS_SUPABASE_URL")
key = os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

print(f"URL: {url}")
try:
    response = requests.get(f"{url}/rest/v1/documents?select=id,title", headers=headers)
    if response.status_code == 200:
        docs = response.json()
        print("Documents in database:")
        for d in docs:
            print(f"- {d['title']} (ID: {d['id']})")
    else:
        print(f"Error: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Error: {e}")
