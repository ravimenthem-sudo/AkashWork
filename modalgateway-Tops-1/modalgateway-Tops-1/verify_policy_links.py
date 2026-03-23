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

def verify_policy_links():
    print("🔗 Verifying Policy Source Links")
    try:
        response = requests.get(f"{url}/rest/v1/policies?select=title,file_url", headers=headers)
        if response.status_code != 200:
            print(f"Failed to fetch policies: {response.status_code}")
            return
            
        policies = response.json()
        for p in policies:
            title = p['title']
            f_url = p['file_url']
            
            if not f_url:
                print(f"❌ {title:<40} | No URL")
                continue
                
            try:
                # Try to get the first 100 bytes of the file to see if it's reachable and what it is
                f_resp = requests.get(f_url, timeout=10, stream=True)
                if f_resp.status_code == 200:
                    content_type = f_resp.headers.get('Content-Type', '')
                    content_length = f_resp.headers.get('Content-Length', 'Unknown')
                    print(f"✅ {title:<40} | Type: {content_type:<20} | Size: {content_length} bytes")
                else:
                    print(f"❌ {title:<40} | Link Broken (Status {f_resp.status_code})")
            except Exception as e:
                print(f"❌ {title:<40} | Connection Error: {e}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_policy_links()
