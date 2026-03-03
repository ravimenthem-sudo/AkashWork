import os
import requests
from dotenv import load_dotenv
import json

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing Supabase credentials")
    exit(1)

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def get_documents():
    # documents table is the RAG one
    url = f"{SUPABASE_URL}/rest/v1/documents?select=id,title,project_id,org_id&limit=10"
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        return resp.json()
    else:
        print(f"Error fetching documents: {resp.text}")
        return []

def get_project_documents():
    # project_documents is the UI one
    # Fixed: use 'title' instead of 'name'
    url = f"{SUPABASE_URL}/rest/v1/project_documents?select=id,title,project_id&limit=10"
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        return resp.json()
    else:
        print(f"Error fetching project_documents: {resp.text}")
        return []

print("--- RAG DOCUMENTS (Vector Store - 'documents') ---")
docs = get_documents()
print(json.dumps(docs, indent=2))

print("\n--- UI DOCUMENTS (Display List - 'project_documents') ---")
ui_docs = get_project_documents()
print(json.dumps(ui_docs, indent=2))
