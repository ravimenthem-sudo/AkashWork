import requests
import re
import json

import os
from dotenv import load_dotenv

# Load env
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

tables = ["profiles", "tasks", "leaves", "attendance", "departments", "teams", "timesheets", "payroll"]
results = {}

for table in tables:
    res = requests.get(f"{url}/rest/v1/{table}?select=*&limit=1", headers=headers)
    if res.status_code == 200 and res.json():
        results[table] = {
            "columns": list(res.json()[0].keys()),
            "sample": res.json()[0]
        }
    else:
        results[table] = "No Data or Error"

# Also get representative IDs for roles
roles = ["executive", "manager", "teamlead", "employee"]
role_ids = {}
for role in roles:
    res = requests.get(f"{url}/rest/v1/profiles?role=eq.{role}&select=id,full_name&limit=1", headers=headers)
    if res.status_code == 200 and res.json():
        role_ids[role] = res.json()[0]
    else:
        role_ids[role] = "None Found"

print(json.dumps({"schemas": results, "role_ids": role_ids}, indent=2))
