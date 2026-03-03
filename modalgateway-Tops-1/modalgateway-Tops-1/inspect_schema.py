import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

def inspect_schema():
    # Check document_chunks
    url = f"{SUPABASE_URL}/rest/v1/document_chunks?limit=1"
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        print(f"document_chunks columns: {list(resp.json()[0].keys())}")
    
    # Check documents
    url = f"{SUPABASE_URL}/rest/v1/documents?limit=1"
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        print(f"documents columns: {list(resp.json()[0].keys())}")

if __name__ == "__main__":
    inspect_schema()
