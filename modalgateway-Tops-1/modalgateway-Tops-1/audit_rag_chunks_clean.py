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

def audit_rag_health():
    print("--- RAG Document Chunk Audit ---")
    try:
        # Get all docs
        response = requests.get(f"{url}/rest/v1/documents?select=id,title,project_id", headers=headers)
        if response.status_code != 200:
            print(f"Error fetching docs: {response.status_code}")
            return
            
        docs = response.json()
        print(f"{'TITLE':<40} | {'CHUNKS':<8} | {'TYPE':<10}")
        print("-" * 65)
        
        for d in docs:
            doc_id = d['id']
            title = d['title'] or "Untitled"
            p_id = d.get('project_id')
            doc_type = "GLOBAL" if not p_id else "PROJECT"
            
            # Count chunks
            chunks_res = requests.get(f"{url}/rest/v1/document_chunks?document_id=eq.{doc_id}&select=id", headers=headers)
            chunk_count = len(chunks_res.json()) if chunks_res.status_code == 200 else 0
            
            print(f"{title[:40]:<40} | {chunk_count:<8} | {doc_type:<10}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    audit_rag_health()
