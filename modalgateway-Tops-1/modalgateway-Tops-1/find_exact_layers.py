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
    response = requests.get(f"{url}/rest/v1/document_chunks?document_id=eq.9e8215f2-8953-4f9d-a124-3776b7f6a210&select=content", headers=headers)
    if response.status_code == 200:
        chunks = response.json()
        for i, c in enumerate(chunks):
            content = c['content']
            if any(marker in content for marker in ["1.", "Layer 1", "Layer 2", "Layer 3", "Layer 4", "Layer 5"]):
                print(f"--- Chunk {i+1} ---")
                # Use encode/decode to safely print to windows console if needed
                print(content.encode('ascii', 'ignore').decode('ascii'))
    else:
        print(f"Error: {response.status_code}")
except Exception as e:
    print(f"Error: {e}")
