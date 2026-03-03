import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
if not SUPABASE_URL:
     print("Error: SUPABASE_URL not found in environment variables.")
     exit(1)
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if not SUPABASE_KEY:
    # Try finding .env in parent directory if not found
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_KEY:
    print("Error: SUPABASE_KEY not found in environment variables.")
    exit(1)

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Range": "0-0"
}

print("Inspecting 'leaves' table...")
resp = requests.get(f"{SUPABASE_URL}/rest/v1/leaves?select=*", headers=headers)
if resp.status_code == 200:
    data = resp.json()
    if data:
        print("Columns found in 'leaves':", list(data[0].keys()))
        print("Sample data:", data[0])
    else:
        print("Table 'leaves' is empty, cannot inspect columns via select.")
else:
    print(f"Error {resp.status_code}: {resp.text}")

print("\nInspecting 'profiles' table...")
resp = requests.get(f"{SUPABASE_URL}/rest/v1/profiles?select=*", headers=headers)
if resp.status_code == 200:
    data = resp.json()
    if data:
        print("Columns found in 'profiles':", list(data[0].keys()))
    else:
        print("Table 'profiles' is empty.")
else:
    print(f"Error {resp.status_code}: {resp.text}")
