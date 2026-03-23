import os
import requests
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("TALENTOPS_SUPABASE_URL")
key = os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}

def list_storage(bucket):
    print(f"\n--- LISTING BUCKET: {bucket} ---")
    list_url = f"{url}/storage/v1/object/list/{bucket}"
    payload = {
        "prefix": "",
        "limit": 20,
        "sortBy": {"column": "created_at", "order": "desc"}
    }
    r = requests.post(list_url, headers=headers, json=payload)
    if r.status_code == 200:
        for f in r.json():
            print(f"- {f['name']} ({f['created_at']})")
    else:
        print(f"Error listing {bucket}: {r.status_code} - {r.text}")

if __name__ == "__main__":
    list_storage("test-folder")
    list_storage("documents")
