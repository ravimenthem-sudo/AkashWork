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

def list_all_chunk_ids():
    print("📋 Listing Unique Document IDs in 'document_chunks'")
    try:
        r = requests.get(f"{url}/rest/v1/document_chunks?select=document_id", headers=headers)
        if r.status_code == 200:
            chunks = r.json()
            ids = set(c['document_id'] for c in chunks)
            print(f"Total unique documents with chunks: {len(ids)}")
            for d_id in ids:
                count = sum(1 for c in chunks if c['document_id'] == d_id)
                print(f" - {d_id}: {count} chunks")
        else:
            print(f"Error: {r.status_code}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_all_chunk_ids()
