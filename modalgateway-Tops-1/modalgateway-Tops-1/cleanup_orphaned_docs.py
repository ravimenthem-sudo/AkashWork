import asyncio, os, sys
sys.path.insert(0, r'd:\chatbot\AkashWork\modalgateway-Tops-1\modalgateway-Tops-1')
from dotenv import load_dotenv
load_dotenv(r'd:\chatbot\AkashWork\modalgateway-Tops-1\modalgateway-Tops-1\.env')
from binding import supabase, init_db

init_db(
    os.getenv('TALENTOPS_SUPABASE_URL'),
    os.getenv('TALENTOPS_SUPABASE_SERVICE_ROLE_KEY'),
    os.getenv('COHORT_SUPABASE_URL'),
    os.getenv('COHORT_SUPABASE_SERVICE_ROLE_KEY')
)

async def cleanup():
    print("🔍 Searching for orphaned documents...")
    
    # Fetch ALL documents to avoid mock client query limitations
    doc_res = await supabase.table("documents").select("id, title, task_id").execute()
    all_docs = doc_res.data or []
    
    docs_with_tasks = [d for d in all_docs if d.get('task_id')]
    print(f"Total documents with task_id: {len(docs_with_tasks)}")
    
    orphaned_doc_ids = []
    orphaned_task_ids = set()
    
    for d in docs_with_tasks:
        t_id = d['task_id']
        # Check if task exists
        t_res = await supabase.table("tasks").select("id").eq("id", t_id).execute()
        if not t_res.data:
            print(f"❌ Orphaned: '{d['title']}' (Doc ID: {d['id']}, Task ID: {t_id})")
            orphaned_doc_ids.append(d['id'])
            orphaned_task_ids.add(t_id)
            
    if not orphaned_doc_ids:
        print("✅ No orphaned documents found.")
        return

    print(f"\n🗑️ Found {len(orphaned_doc_ids)} orphaned documents across {len(orphaned_task_ids)} missing tasks.")
    
    # 2. Delete Orphaned Chunks and Documents
    for tid in orphaned_task_ids:
        print(f"Cleaning up Task ID: {tid}...")
        # Chunks
        await supabase.table("document_chunks").delete().eq("task_id", tid).execute()
        # Documents
        await supabase.table("documents").delete().eq("task_id", tid).execute()

    print("\n✅ Cleanup complete.")

asyncio.run(cleanup())
