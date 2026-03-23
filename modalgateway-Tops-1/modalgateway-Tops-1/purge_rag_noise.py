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

PURGE_TITLES = [
    "SLM Test Doc",
    "Verification Doc",
    "Production Verification Doc",
    "Test Doc"
]

def purge_technical_noise():
    print("🧹 Purging Technical Noise from RAG...")
    try:
        for title in PURGE_TITLES:
            print(f"Checking for '{title}'...")
            res = requests.get(f"{url}/rest/v1/documents?title=eq.{title}&select=id", headers=headers)
            if res.status_code == 200:
                docs = res.json()
                if not docs:
                    print(f"   No documents found with title '{title}'")
                    continue
                    
                for d in docs:
                    doc_id = d['id']
                    print(f"   Deleting document {doc_id} ('{title}')...")
                    # Cascade delete should handle chunks
                    del_res = requests.delete(f"{url}/rest/v1/documents?id=eq.{doc_id}", headers=headers)
                    if del_res.status_code in [200, 204]:
                        print(f"   ✅ Successfully deleted '{title}'")
                    else:
                        print(f"   ❌ Failed to delete '{title}': {del_res.status_code}")
            else:
                print(f"Error checking for '{title}': {res.status_code}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    purge_technical_noise()
