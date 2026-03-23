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

def check_org_policies():
    org_id = 'dde0a075-5eb3-4b4b-8de3-0a6b1162951f'
    print(f"Checking policies for org_id: {org_id}")
    try:
        r = requests.get(f"{url}/rest/v1/documents?org_id=eq.{org_id}&project_id=is.null&select=title,id", headers=headers)
        docs = r.json()
        print(f"Found {len(docs)} policies for this org:")
        for d in docs:
            print(f"- {d.get('title')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_org_policies()
