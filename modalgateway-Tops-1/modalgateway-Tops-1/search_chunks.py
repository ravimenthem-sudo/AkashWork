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
    # Searching for 'layer' in chunks
    response = requests.get(f"{url}/rest/v1/document_chunks?content=ilike.*layer*&select=content,document_id", headers=headers)
    if response.status_code == 200:
        chunks = response.json()
        print(f"Found {len(chunks)} chunks containing 'layer':")
        for i, c in enumerate(chunks[:10]): # Show first 10
            print(f"\n--- Chunk {i+1} (Doc: {c['document_id']}) ---")
            print(c['content'])
    else:
        print(f"Error: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Error: {e}")
