import os
from dotenv import load_dotenv

load_dotenv()
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if not SUPABASE_KEY:
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")

tables_to_check = ["departments", "teams", "timesheets", "documents", "support_tickets"]
headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

results = {}
for table in tables_to_check:
    url = f"{SUPABASE_URL}/rest/v1/{table}?limit=1"
    resp = requests.get(url, headers=headers)
    results[table] = "Exists" if resp.status_code == 200 else f"Missing/Error ({resp.status_code})"

print(json.dumps(results, indent=2))
