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

def verify_rag_content():
    print("📋 RAG Content Audit - Deep Dive")
    try:
        # 1. Fetch some global policy chunks
        print("\n--- GLOBAL POLICY CHUNKS ---")
        response = requests.get(f"{url}/rest/v1/document_chunks?project_id=is.null&select=content,document_id,id", headers=headers)
        if response.status_code == 200:
            chunks = response.json()
            print(f"Total global chunks found: {len(chunks)}")
            
            # Group by document_id
            doc_chunks = {}
            for c in chunks:
                d_id = c['document_id']
                if d_id not in doc_chunks:
                    doc_chunks[d_id] = []
                doc_chunks[d_id].append(c)
                
            for d_id, c_list in list(doc_chunks.items())[:5]: # Check first 5 docs
                # Get title
                d_res = requests.get(f"{url}/rest/v1/documents?id=eq.{d_id}&select=title", headers=headers)
                title = d_res.json()[0]['title'] if d_res.status_code == 200 and d_res.json() else "Unknown"
                
                print(f"\n📄 Document: {title} ({d_id})")
                print(f"   Chunks count: {len(c_list)}")
                for i, c in enumerate(c_list):
                    content = c['content']
                    words = len(content.split())
                    print(f"   - Chunk {i+1} ID: {c['id']} | Word Count: {words}")
                    print(f"     Preview: {content[:300]}...")
        else:
            print(f"Error fetching chunks: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_rag_content()
