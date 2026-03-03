import requests
import uuid
import time
import json
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "http://localhost:8040"
PROJECT_ID = "11d82a1c-f4fe-4249-b8b0-ce61166c2f43"
UNIQUE_CODE = f"Bravo-{int(time.time())}"
TEST_TEXT = f"The secret project code for this mission is {UNIQUE_CODE}. Confidentially is required."

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def get_org_id():
    print("Fetching Org ID...")
    url = f"{SUPABASE_URL}/rest/v1/projects?select=org_id&id=eq.{PROJECT_ID}"
    try:
        resp = requests.get(url, headers=headers)
        data = resp.json()
        if data and len(data) > 0:
            return data[0]['org_id']
    except Exception as e:
        print(f"Error fetching Org ID: {e}")
    return None

def test_pipeline():
    # 1. Get Org ID
    org_id = get_org_id()
    if not org_id:
        print("❌ Could not resolve Org ID. Make sure PROJECT_ID exists in your DB.")
        # Fallback for testing if project doesn't exist - use a fake UUID
        org_id = str(uuid.uuid4())
        print(f"⚠️ Using generated Org ID for testing: {org_id}")
    else:
        print(f"✅ Resolved Org ID: {org_id}")

    # 2. Ingest
    print(f"\n--- TESTING INGESTION of code: {UNIQUE_CODE} ---")
    doc_id = str(uuid.uuid4())
    payload = {
        "doc_id": doc_id,
        "project_id": PROJECT_ID,
        "org_id": org_id, 
        "text": TEST_TEXT,
        "metadata": {"title": "Production Verification Doc"}
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/docs/ingest", json=payload)
        data = resp.json()
        print(f"Ingest Response: {data}")
        
        if not data.get("success"):
            print("❌ INGESTION FAILED")
            return

        # WAIT FOR DB INDEXING
        print("Waiting 3s for DB indexing...")
        time.sleep(3)
    except Exception as e:
        print(f"❌ CONNECTION ERROR (Ingest): {e}")
        return

    # 3. Query (Expected Success)
    print(f"\n--- TESTING QUERY (Context) ---")
    query_payload = {
        "question": "What is the secret project code?",
        "org_id": org_id,
        "project_id": PROJECT_ID
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/query", json=query_payload)
        data = resp.json()
        print(f"Query Response: {data}")
        
        answer = data.get("answer", "")
        if UNIQUE_CODE in answer:
            print("✅ QUERY SUCCESS: Correct Answer Retrieved")
        else:
            print(f"⚠️ QUERY MISS: Expected {UNIQUE_CODE}, got '{answer}'")
            # Note: Indexing latency might cause this.
            
    except Exception as e:
         print(f"❌ CONNECTION ERROR (Query): {e}")

    # 4. Query (Fallback)
    print(f"\n--- TESTING QUERY (Fallback) ---")
    query_payload_fallback = {
        "question": "What is the capital of France?", # Generic knowledge
        "org_id": org_id,
        "project_id": PROJECT_ID
    }
    try:
        resp = requests.post(f"{BASE_URL}/query", json=query_payload_fallback)
        data = resp.json()
        print(f"Fallback Response: {data}")
        answer = data.get("answer", "")
        if "Paris" in answer:
             print("✅ FALLBACK SUCCESS: Retrieved General Knowledge")
        else:
             print(f"⚠️ FALLBACK MISS: '{answer}'")
    except Exception as e:
        print(f"Faillure: {e}")

if __name__ == "__main__":
    test_pipeline()
