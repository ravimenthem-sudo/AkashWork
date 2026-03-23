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

def list_all_docs():
    r = requests.get(f"{url}/rest/v1/documents?select=title,id,created_at,project_id&order=created_at.desc", headers=headers)
    if r.status_code == 200:
        for d in r.json():
            print(f"- {d.get('title')} ({d.get('id')}) created at {d.get('created_at')}")
    else:
        print(f"Error: {r.status_code} - {r.text}")

if __name__ == "__main__":
    list_all_docs()
