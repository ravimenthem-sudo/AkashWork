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

try:
    # Use the Doc ID from previous results: 9e8215f2-8953-4f9d-a124-3776b7f6a210
    doc_id = "9e8215f2-8953-4f9d-a124-3776b7f6a210"
    response = requests.get(f"{url}/rest/v1/document_chunks?document_id=eq.{doc_id}&select=content", headers=headers)
    if response.status_code == 200:
        chunks = response.json()
        full_text = "\n".join([c['content'] for c in chunks])
        print("--- FULL DOCUMENT CONTENT ---")
        print(full_text)
    else:
        print(f"Error: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Error: {e}")
