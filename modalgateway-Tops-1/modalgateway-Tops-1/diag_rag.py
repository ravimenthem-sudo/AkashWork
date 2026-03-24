import os
import json
import asyncio
from supabase import create_client

async def diagnose():
    url = os.environ.get("TALENTOPS_SUPABASE_URL")
    key = os.environ.get("TALENTOPS_SERVICE_ROLE_KEY")
    if not url or not key:
        print("❌ ERROR: Supabase credentials missing from Environment.")
        return

    supabase = create_client(url, key)
    
    # 1. Search for documents with 'Requirement' or 'Refiner'
    print("\n--- 📝 Searching for 'Requirement' or 'Refiner' Documents ---")
    resp = supabase.table("documents").select("id, title, org_id, project_id, task_id, phase").ilike("title", "%Refiner%").execute()
    docs = resp.data or []
    
    if not docs:
        # Try searching by context
        resp = supabase.table("documents").select("id, title, org_id, project_id, task_id, phase").ilike("title", "%Requirement%").execute()
        docs = resp.data or []
        
    for d in docs:
        print(f"TITLE: {d.get('title')}")
        print(f"  ID: {d.get('id')}")
        print(f"  ORG: {d.get('org_id')}")
        print(f"  PROJ: {d.get('project_id')}")
        print(f"  TASK: {d.get('task_id')}")
        print(f"  PHASE: {d.get('phase')}")
        
        # 2. Check chunks count
        c_resp = supabase.table("document_chunks").select("id", count="exact").eq("document_id", d.get('id')).execute()
        print(f"  CHUNKS: {c_resp.count}")
        print("-" * 30)

    if not docs:
        print("❌ NO DOCUMENTS FOUND matching 'Requirement' or 'Refiner'.")
        
    # 3. List all docs in the last 10 entries
    print("\n--- 🕒 Last 10 Documents ---")
    resp = supabase.table("documents").select("id, title, created_at").order("created_at", desc=True).limit(10).execute()
    for d in (resp.data or []):
        print(f"[{d.get('created_at')}] {d.get('title')} ({d.get('id')})")

if __name__ == "__main__":
    asyncio.run(diagnose())
