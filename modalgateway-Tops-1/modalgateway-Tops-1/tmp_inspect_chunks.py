import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("TALENTOPS_SUPABASE_URL")
SUPABASE_KEY = os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def inspect_doc_chunks(doc_id):
    print(f"--- INSPECTING CHUNKS FOR DOC ID: {doc_id} ---")
    url = f"{SUPABASE_URL}/rest/v1/document_chunks?document_id=eq.{doc_id}&select=content"
    resp = requests.get(url, headers=headers)
    
    if resp.status_code != 200:
        print(f"Error fetching: {resp.text}")
        return

    data = resp.json()
    print(f"Total Chunks: {len(data)}")
    for i, chunk in enumerate(data):
        print(f"--- Chunk {i+1} ---")
        print(chunk['content'][:1000]) # Show first 1000 chars
        print("-------------------")
        
if __name__ == "__main__":
    # sdlc testing phase document ID
    inspect_doc_chunks('2120e64d-e92d-41b6-954e-180351cb7041')
