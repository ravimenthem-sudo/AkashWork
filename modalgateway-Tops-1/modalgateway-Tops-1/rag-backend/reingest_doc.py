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

def reingest_slm_doc():
    # 1. Find the document in project_documents
    url = f"{SUPABASE_URL}/rest/v1/project_documents?title=eq.SLM%20Test%20Doc&select=*"
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200 or not resp.json():
        print("Could not find 'SLM Test Doc' in project_documents")
        return

    doc = resp.json()[0]
    print(f"Found Doc: {doc['id']} - {doc['title']}")
    print(f"File URL: {doc.get('file_url')}")

    # 2. Send to Ingest API
    ingest_payload = {
        "doc_id": doc['id'],
        "file_url": doc['file_url'],
        "text": doc.get('content', ''),
        # Use the ID that matched the chatbox hardcode for now to ensure visibility
        "project_id": "11d82a1c-f4fe-4249-b8b0-ce61166c2f43", 
        "org_id": "66bed17d-978f-43c7-8b63-3a4c3e331efb",
        "metadata": {
            "title": doc['title'],
            "document_type": doc.get('doc_type', 'project_doc')
        }
    }

    try:
        print("Sending to RAG Backend...")
        r = requests.post("http://localhost:8040/docs/ingest", json=ingest_payload)
        print(f"Status: {r.status_code}")
        print(f"Response: {r.text}")
    except Exception as e:
        print(f"Failed to call backend: {e}")

if __name__ == "__main__":
    reingest_slm_doc()
