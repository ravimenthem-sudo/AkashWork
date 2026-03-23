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

print("Checking documents for task_id...")
res_docs = requests.get(f"{url}/rest/v1/documents?task_id=not.is.null&select=id,title,task_id", headers=headers)
if res_docs.status_code == 200:
    docs = res_docs.json()
    print(f"Found {len(docs)} documents with a task_id.")
    for d in docs:
        print(f" - Doc ID: {d.get('id')}, Title: {d.get('title')}, Task ID: {d.get('task_id')}")
else:
    print("Error fetching documents:", res_docs.status_code, res_docs.text)

print("\nChecking chunks for task_id...")
res_chunks = requests.get(f"{url}/rest/v1/document_chunks?task_id=not.is.null&select=id,document_id,task_id", headers=headers)
if res_chunks.status_code == 200:
    chunks = res_chunks.json()
    print(f"Found {len(chunks)} chunks with a task_id.")
    for c in chunks[:5]:
        print(f" - Chunk ID: {c.get('id')}, Doc ID: {c.get('document_id')}, Task ID: {c.get('task_id')}")
else:
    print("Error fetching chunks:", res_chunks.status_code, res_chunks.text)
