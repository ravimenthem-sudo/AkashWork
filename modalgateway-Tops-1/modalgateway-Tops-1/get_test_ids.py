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
    response = requests.get(f"{url}/rest/v1/documents?title=eq.Production Verification Doc&select=org_id,project_id", headers=headers)
    print(response.json())
except Exception as e:
    print(f"Error: {e}")
