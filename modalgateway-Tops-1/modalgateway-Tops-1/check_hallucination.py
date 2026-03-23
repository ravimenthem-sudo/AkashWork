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

try:
    keywords = ["HR Conversation Layer", "Project Conversation Layer", "Progress Explanation Layer"]
    for kw in keywords:
        response = requests.get(f"{url}/rest/v1/document_chunks?content=ilike.*{kw}*&select=content,document_id", headers=headers)
        if response.status_code == 200:
            chunks = response.json()
            if chunks:
                print(f"--- Found '{kw}' in {len(chunks)} chunks ---")
                for c in chunks:
                    print(c['content'])
            else:
                print(f"--- '{kw}' not found in any chunks ---")
        else:
            print(f"Error for '{kw}': {response.status_code}")
except Exception as e:
    print(f"Error: {e}")
