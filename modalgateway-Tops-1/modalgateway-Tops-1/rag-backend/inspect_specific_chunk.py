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

def inspect_slm_chunks():
    print("--- INSPECTING SLM TEST DOC CHUNKS ---")
    doc_id = 'b3a138aa-72c9-4890-a65b-85346c195bf5' # SLM Test Doc ID
    
    url = f"{SUPABASE_URL}/rest/v1/document_chunks?document_id=eq.{doc_id}&select=content"
    resp = requests.get(url, headers=headers)
    
    if resp.status_code != 200:
        print(f"Error fetching: {resp.text}")
        return

    data = resp.json()
    print(f"Total Chunks for this Doc: {len(data)}")
    for i, chunk in enumerate(data):
        print(f"--- Chunk {i+1} ---")
        print(chunk['content'])
        print("-------------------")
        
if __name__ == "__main__":
    inspect_slm_chunks()
