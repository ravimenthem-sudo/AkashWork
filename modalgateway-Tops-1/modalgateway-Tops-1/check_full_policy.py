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

def check_one_policy():
    print("📋 Checking Full Content of a Policy Chunk")
    try:
        response = requests.get(f"{url}/rest/v1/document_chunks?project_id=is.null&select=content,document_id&limit=1", headers=headers)
        if response.status_code == 200:
            c = response.json()[0]
            print(f"Doc ID: {c['document_id']}")
            print(f"Length: {len(c['content'])} characters")
            print("-" * 50)
            print(c['content'])
            print("-" * 50)
        else:
            print(f"Error: {response.status_code}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_one_policy()
