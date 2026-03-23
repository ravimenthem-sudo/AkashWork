import requests
import os
import json
from dotenv import load_dotenv

load_dotenv('.env')

url = os.getenv('TALENTOPS_SUPABASE_URL')
key = os.getenv('TALENTOPS_SUPABASE_SERVICE_ROLE_KEY')
headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json'
}

# The task_id from the user's terminal
task_id = "e8b80edd-2952-4c60-8dde-6bbb9813c4a1"
org_id = "f81d4fae-7dec-11d0-a765-00a0c91e6bf6" # Standard org_id in this project

print(f"--- TESTING RETRIEVAL FOR TASK: {task_id} ---")

# 1. Test direct chunk fetch
print("\n[1] Checking direct chunk fetch...")
r = requests.get(f"{url}/rest/v1/document_chunks?task_id=eq.{task_id}&select=content", headers=headers)
chunks = r.json()
print(f"Found {len(chunks)} chunks.")
if chunks:
    # Use index 0 but handle if list is empty
    print(f"First chunk snippet: {chunks[0]['content'][:100]}...")

# 2. Test RPC match_documents (Simulating rag_query)
# We need an embedding. I'll use a dummy one or just check if the RPC returns anything with a low threshold.
print("\n[2] Checking RPC match_documents with low threshold (0.1)...")
# Note: I don't have a real embedding here, so I'll just check if filtering works as expected
# Or I can try to find an embedding from an existing chunk
r_emb = requests.get(f"{url}/rest/v1/document_chunks?task_id=eq.{task_id}&select=embedding&limit=1", headers=headers)
if r_emb.status_code == 200 and r_emb.json():
    dummy_emb = r_emb.json()[0]['embedding']
    payload = {
        "query_embedding": dummy_emb,
        "match_threshold": 0.1,
        "match_count": 5,
        "filter": {"task_id": task_id}
    }
    r_rpc = requests.post(f"{url}/rest/v1/rpc/match_documents", headers=headers, json=payload)
    print(f"RPC Status: {r_rpc.status_code}")
    print(f"RPC Matches: {len(r_rpc.json()) if r_rpc.status_code == 200 else r_rpc.text}")
else:
    print(f"Could not find an embedding to test RPC. Response: {r_emb.text}")
