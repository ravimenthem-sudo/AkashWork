import requests
import re
import json

import os
from dotenv import load_dotenv

# Load env variables
load_dotenv()
url = os.getenv("SUPABASE_URL", "https://ppptzmmecvjuvbulvddh.supabase.co")
key = os.getenv("SUPABASE_KEY")

if not key:
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))
    key = os.getenv("SUPABASE_KEY")

if not key:
    print("Error: SUPABASE_KEY not found in environment")
    exit(1)

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

print(f"URL: {url}")

# 1. Get a valid Profile ID
p_res = requests.get(f"{url}/rest/v1/profiles?select=id&limit=1", headers=headers)
if p_res.status_code == 200 and p_res.json():
    print(f"VALID_ID: {p_res.json()[0]['id']}")
else:
    print("VALID_ID: None")

# 2. Get Attendance columns
a_res = requests.get(f"{url}/rest/v1/attendance?select=*&limit=1", headers=headers)
if a_res.status_code == 200 and a_res.json():
    print(f"ATTENDANCE_COLS: {list(a_res.json()[0].keys())}")
else:
    # Try to get from schema definition if no data
    print("ATTENDANCE_COLS: No Data")
