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

def audit_ingestion():
    print("📋 Comprehensive Ingestion Audit")
    try:
        # 1. Fetch all documents
        d_res = requests.get(f"{url}/rest/v1/documents?select=id,title,project_id", headers=headers)
        docs = d_res.json()
        print(f"Total documents in database: {len(docs)}")
        
        # 2. Fetch all chunk counts
        c_res = requests.get(f"{url}/rest/v1/document_chunks?select=document_id", headers=headers)
        chunks = c_res.json()
        
        chunk_counts = {}
        for c in chunks:
            d_id = c['document_id']
            chunk_counts[d_id] = chunk_counts.get(d_id, 0) + 1
            
        print(f"{'TITLE':<40} | {'PROJECT_ID':<40} | {'CHUNKS':<8}")
        print("-" * 95)
        
        for d in docs:
            d_id = d['id']
            title = d['title']
            p_id = d.get('project_id')
            count = chunk_counts.get(d_id, 0)
            
            print(f"{title[:40]:<40} | {str(p_id):<40} | {count}")
            
        # 3. Specifically check for documents with 0 chunks
        missing = [d['title'] for d in docs if chunk_counts.get(d['id'], 0) == 0]
        if missing:
            print("\n❌ DOCUMENTS WITH 0 CHUNKS (NOT SEARCHABLE):")
            for m in missing:
                print(f"  - {m}")
        else:
            print("\n✅ All documents have at least one chunk.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    audit_ingestion()
