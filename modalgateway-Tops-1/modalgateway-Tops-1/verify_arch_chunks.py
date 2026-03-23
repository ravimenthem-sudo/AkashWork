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

def verify_arch_chunks():
    print("🏢 Verifying Architecture Document Chunks")
    doc_id = "833ab297-26fb-4c33-a90d-92a6cf3e76f5"
    try:
        r = requests.get(f"{url}/rest/v1/document_chunks?document_id=eq.{doc_id}&select=content", headers=headers)
        if r.status_code == 200:
            chunks = r.json()
            print(f"Total chunks found: {len(chunks)}")
            if chunks:
                print(f"First chunk length: {len(chunks[0]['content'])} characters")
                print(f"Preview: {chunks[0]['content'][:100]}...")
        else:
            print(f"Error: {r.status_code}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_arch_chunks()
