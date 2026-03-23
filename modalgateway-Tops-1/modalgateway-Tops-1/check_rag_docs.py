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
    response = requests.get(f"{url}/rest/v1/documents?select=*", headers=headers)
    if response.status_code == 200:
        docs = response.json()
        print(f"Total documents in RAG 'documents' table: {len(docs)}")
        for d in docs: 
            print(f"- {d.get('title')} (ID: {d.get('id')}, Project: {d.get('project_id')})")
    else:
        print(f"Error: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Error: {e}")
