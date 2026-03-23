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

def audit_global_policies():
    print("--- AUDITING GLOBAL POLICIES ---")
    # Get all documents with null project_id
    r = requests.get(f"{url}/rest/v1/documents?project_id=is.null&select=id,title", headers=headers)
    if r.status_code == 200:
        docs = r.json()
        print(f"Found {len(docs)} Global Policies.\n")
        for d in docs:
            doc_id = d['id']
            title = d['title']
            
            # Check chunks
            cr = requests.get(f"{url}/rest/v1/document_chunks?document_id=eq.{doc_id}&select=id", headers=headers)
            chunk_count = len(cr.json()) if cr.status_code == 200 else "Error"
            
            print(f"Title: {title}")
            print(f"  ID: {doc_id}")
            print(f"  Chunks in 'document_chunks': {chunk_count}")
            print("-" * 30)
    else:
        print(f"Error fetching documents: {r.status_code} - {r.text}")

if __name__ == "__main__":
    audit_global_policies()
