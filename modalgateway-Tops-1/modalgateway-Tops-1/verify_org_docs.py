import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("TALENTOPS_SUPABASE_URL")
key = os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

correct_org = "dde0a075-5eb3-4b4b-8de3-0a6b1162951f"

print(f"--- All Documents for Org: {correct_org} ---")
try:
    res = supabase.table("documents").select("title, org_id").eq("org_id", correct_org).execute()
    docs = res.data or []
    for d in docs:
        print(f"  - {d['title']}")
except Exception as e:
    print(f"DB Check Failed: {e}")
