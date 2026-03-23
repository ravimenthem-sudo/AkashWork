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

def search_chunks_content():
    print("--- SEARCHING CHUNKS FOR 'DESIGN' ---")
    r = requests.get(f"{url}/rest/v1/document_chunks?content=ilike.*design*&select=document_id,content", headers=headers)
    if r.status_code == 200:
        chunks = r.json()
        print(f"Found {len(chunks)} chunks.")
        unique_docs = set(c['document_id'] for c in chunks)
        for doc_id in unique_docs:
            count = sum(1 for c in chunks if c['document_id'] == doc_id)
            print(f"Doc ID: {doc_id} | Chunks with 'design': {count}")
            # Get title for this doc
            tr = requests.get(f"{url}/rest/v1/documents?id=eq.{doc_id}&select=title", headers=headers)
            if tr.status_code == 200 and tr.json():
                print(f"  Title: {tr.json()[0]['title']}")
    else:
        print(f"Error: {r.status_code} - {r.text}")

if __name__ == "__main__":
    search_chunks_content()
