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

def download_one_pdf():
    print("📥 Attempting to Download One Policy PDF")
    try:
        response = requests.get(f"{url}/rest/v1/policies?select=title,file_url", headers=headers)
        if response.status_code != 200:
            print(f"Failed to fetch policies: {response.status_code}")
            return
            
        policies = response.json()
        if not policies:
            print("No policies found.")
            return

        # Pick the first one that has a URL
        target = next((p for p in policies if p.get('file_url')), None)
        if not target:
            print("No policy with a URL found.")
            return

        print(f"Title: {target['title']}")
        f_url = target['file_url']
        print(f"URL: {f_url}")

        f_resp = requests.get(f_url, timeout=10)
        if f_resp.status_code == 200:
            print(f"✅ Downloaded successfully. Size: {len(f_resp.content)} bytes")
            # Save to temp file to check
            with open("test_policy.pdf", "wb") as f:
                f.write(f_resp.content)
            print("Saved as 'test_policy.pdf'")
        else:
            print(f"❌ Failed to download. Status: {f_resp.status_code}")
            print(f"Response: {f_resp.text[:500]}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    download_one_pdf()
