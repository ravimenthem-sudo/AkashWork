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
    # Get columns for project_documents
    print("Columns for project_documents:")
    resp1 = requests.get(f"{url}/rest/v1/project_documents?select=*", headers=headers, params={"limit": 1})
    if resp1.status_code == 200 and resp1.json():
        print(resp1.json()[0].keys())
    
    # Get columns for documents
    print("\nColumns for documents (RAG):")
    resp2 = requests.get(f"{url}/rest/v1/documents?select=*", headers=headers, params={"limit": 1})
    if resp2.status_code == 200 and resp2.json():
        print(resp2.json()[0].keys())
except Exception as e:
    print(f"Error: {e}")
