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

def search_all_tables():
    today = "2026-03-20"
    tables = ['documents', 'project_documents', 'tasks', 'task_comments', 'task_history']
    
    print(f"--- SEARCHING FOR 'DESIGN' OR CREATED AFTER {today} ---")
    
    for table in tables:
        print(f"\nChecking table: {table}")
        # Search for 'design' in any common column
        query = f"or=(title.ilike.*design*,content.ilike.*design*,comment_text.ilike.*design*,description.ilike.*design*,phase.ilike.*design*)"
        r = requests.get(f"{url}/rest/v1/{table}?{query}&select=*", headers=headers)
        if r.status_code == 200:
            data = r.json()
            if data:
                for row in data:
                    print(f"MATCH (design): {row.get('title') or row.get('id')} - {row.get('created_at')}")
            else:
                print("No 'design' matches.")
        
        # Search for today's entries
        r = requests.get(f"{url}/rest/v1/{table}?created_at=gte.{today}&select=*", headers=headers)
        if r.status_code == 200:
            data = r.json()
            if data:
                for row in data:
                    print(f"MATCH (today): {row.get('title') or row.get('id')} - {row.get('created_at')}")
            else:
                print("No entries today.")
        else:
            print(f"Error checking {table}: {r.status_code}")

if __name__ == "__main__":
    search_all_tables()
