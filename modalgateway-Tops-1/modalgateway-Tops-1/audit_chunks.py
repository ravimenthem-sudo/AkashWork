import requests
import os
import json
import sys
from dotenv import load_dotenv

load_dotenv('.env')

url = os.getenv('TALENTOPS_SUPABASE_URL')
key = os.getenv('TALENTOPS_SUPABASE_SERVICE_ROLE_KEY')
headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}'
}

# Accept Doc ID as argument
doc_id = sys.argv[1] if len(sys.argv) > 1 else '85e3d7ea-7066-4af7-bf17-f1b97209afce'

print(f"--- AUDITING DOC: {doc_id} ---")

r = requests.get(f"{url}/rest/v1/document_chunks?document_id=eq.{doc_id}&select=content,org_id,project_id,task_id", headers=headers)
if r.status_code == 200:
    chunks = r.json()
    print(f"Total Chunks: {len(chunks)}")
    for i, c in enumerate(chunks):
        content = c.get('content', '')
        oid = c.get('org_id')
        pid = c.get('project_id')
        tid = c.get('task_id')
        print(f"\n[CHUNK {i}] (Org: {oid}, Project: {pid}, Task: {tid})\n{content[:500]}...")
        print("-" * 40)
else:
    print(f"Error fetching chunks: {r.status_code} - {r.text}")
