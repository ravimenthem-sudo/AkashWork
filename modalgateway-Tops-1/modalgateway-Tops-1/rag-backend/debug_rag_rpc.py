import os
import requests
from dotenv import load_dotenv
import json

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def check_chunks():
    print("--- CHECKING DOCUMENT CHUNKS ---")
    # Fetch chunks for the project we are testing
    project_id = '11d82a1c-f4fe-4249-b8b0-ce61166c2f43'
    org_id = '66bed17d-978f-43c7-8b63-3a4c3e331efb'
    
    url = f"{SUPABASE_URL}/rest/v1/document_chunks?select=id,document_id,org_id,project_id,content&limit=5"
    resp = requests.get(url, headers=headers)
    
    if resp.status_code != 200:
        print(f"Error fetching chunks: {resp.text}")
        return

    chunks = resp.json()
    print(f"Total chunks retrieved: {len(chunks)}")
    for c in chunks:
        print(f"Chunk ID: {c['id']}")
        print(f"  Org Match? {c['org_id'] == org_id} (Expected: {org_id}, Found: {c['org_id']})")
        print(f"  Project Match? {c['project_id'] == project_id} (Expected: {project_id}, Found: {c['project_id']})")
        print(f"  Content Preview: {c['content'][:50]}...")

def test_rpc_call():
    print("\n--- TESTING MATCH_DOCUMENTS RPC ---")
    # We'll rely on the server to get embeddings usually, but here we can try a direct call 
    # if we had an embedding. Since we don't have an embedding easily without calling OpenAI,
    # let's just inspect the previous output. 
    pass

if __name__ == "__main__":
    check_chunks()
