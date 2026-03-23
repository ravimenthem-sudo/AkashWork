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

def list_global_policies():
    print("📋 Listing Global Policies (project_id IS NULL)...")
    try:
        # project_id=is.null
        response = requests.get(f"{url}/rest/v1/documents?project_id=is.null&select=title,id,org_id", headers=headers)
        if response.status_code == 200:
            docs = response.json()
            print(f"Total Global Policies: {len(docs)}")
            for d in docs:
                print(f"- {d.get('title')} (ID: {d.get('id')}, Org: {d.get('org_id')})")
        else:
            print(f"Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_global_policies()
