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
    doc_id = "9e8215f2-8953-4f9d-a124-3776b7f6a210"
    response = requests.get(f"{url}/rest/v1/document_chunks?document_id=eq.{doc_id}&select=content", headers=headers)
    if response.status_code == 200:
        chunks = response.json()
        print(f"--- Document ID: {doc_id} ---")
        for i, c in enumerate(chunks):
            print(f"\n[Chunk {i+1}]\n{c['content']}")
            print("-" * 40)
    else:
        print(f"Error: {response.status_code}")
except Exception as e:
    print(f"Error: {e}")
