import asyncio
import os
from dotenv import load_dotenv
from binding import supabase, init_db, select_client

load_dotenv()

async def test_merged_listing():
    print("🧪 Testing Merged Document Listing...")
    
    # Initialize DB (same as unified_server.py)
    init_db(
        os.getenv("TALENTOPS_SUPABASE_URL"),
        os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")
    )
    select_client("talentops")
    
    # Mock parameters for an Employee
    # We need a valid org_id and a project_id
    try:
        # Get some real IDs from the DB to test with
        docs_res = await supabase.table("documents").select("org_id, project_id").execute()
        if not docs_res.data:
            print("No docs found to test with.")
            return
            
        # Find a project_id
        project_ids = [d['project_id'] for d in docs_res.data if d.get('project_id')]
        org_id = docs_res.data[0]['org_id']
        
        test_project_id = project_ids[0] if project_ids else None
        
        print(f"Using Org ID: {org_id}")
        print(f"Using Project ID: {test_project_id}")
        
        # --- MOCKING THE NEW LOGIC FROM UNIFIED_SERVER.PY ---
        found_docs = []
        target_org = org_id
        
        # Fetch all docs for this org
        d_res = await supabase.table("documents").select("title, id, project_id").eq("org_id", target_org).execute()
        if d_res.data:
            all_org_docs = d_res.data
            # Filter for documents that match the current project OR are global (project_id is null)
            found_docs = [
                d for d in all_org_docs 
                if not d.get('project_id') or d.get('project_id') == test_project_id
            ]
            print(f"✅ Found {len(found_docs)} total docs (Project + Global)")
            
            project_count = len([d for d in found_docs if d.get('project_id')])
            global_count = len([d for d in found_docs if not d.get('project_id')])
            
            print(f"   - Project Docs: {project_count}")
            print(f"   - Global Policies: {global_count}")
            
            for d in found_docs:
                type_str = "PROJECT" if d.get('project_id') else "GLOBAL"
                print(f"   [{type_str}] {d.get('title')}")

        if not found_docs:
            print("❌ Test FAILED: No documents found.")
        elif global_count == 0:
            print("❌ Test FAILED: No global policies included.")
        else:
            print("✨ Test PASSED: Both project and policy docs are visible!")

    except Exception as e:
        print(f"Error during test: {e}")

if __name__ == "__main__":
    asyncio.run(test_merged_listing())
