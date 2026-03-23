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

def get_summary():
    print("--- POLICY CHUNK SUMMARY ---")
    try:
        r = requests.get(f"{url}/rest/v1/documents?project_id=is.null&select=title,id,org_id", headers=headers)
        docs = r.json()
        print(f"{'TITLE':<40} | {'ORG_ID':<40} | {'CHUNKS':<8}")
        print("-" * 95)
        for d in docs:
            d_id = d['id']
            title = d['title']
            oid = d.get('org_id')
            chunks = requests.get(f"{url}/rest/v1/document_chunks?document_id=eq.{d_id}&select=id", headers=headers).json()
            print(f"{title[:40]:<40} | {str(oid):<40} | {len(chunks)} chunks")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_summary()
