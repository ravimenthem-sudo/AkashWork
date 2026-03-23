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
    # Searching for 'LLM' in chunks
    response = requests.get(f"{url}/rest/v1/document_chunks?content=ilike.*LLM*&select=content,document_id", headers=headers)
    if response.status_code == 200:
        chunks = response.json()
        print(f"Found {len(chunks)} chunks containing 'LLM':")
        for i, c in enumerate(chunks):
            if "Layer" in c['content'] or "layer" in c['content']:
                print(f"\n--- Chunk {i+1} (Doc: {c['document_id']}) ---")
                print(c['content'])
    else:
        print(f"Error: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Error: {e}")
