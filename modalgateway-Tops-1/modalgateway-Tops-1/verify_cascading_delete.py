import asyncio, os, sys, uuid, json
sys.path.insert(0, r'd:\chatbot\AkashWork\modalgateway-Tops-1\modalgateway-Tops-1')
from dotenv import load_dotenv
load_dotenv(r'd:\chatbot\AkashWork\modalgateway-Tops-1\modalgateway-Tops-1\.env')
from binding import supabase, init_db, RAGIngestRequest
from unified_server import rag_ingest, slm_chat
from binding import SLMQueryRequest

init_db(
    os.getenv('TALENTOPS_SUPABASE_URL'),
    os.getenv('TALENTOPS_SUPABASE_SERVICE_ROLE_KEY'),
    os.getenv('COHORT_SUPABASE_URL'),
    os.getenv('COHORT_SUPABASE_SERVICE_ROLE_KEY')
)

async def test_cascade():
    org_id = 'dde0a075-5eb3-4b4b-8de3-0a6b1162951f'
    # 1. Create a dummy task
    task_id = str(uuid.uuid4())
    print(f"Creating test task: {task_id}")
    await supabase.table("tasks").insert({
        "id": task_id,
        "title": "Verifying Cascading Delete Task",
        "org_id": org_id,
        "status": "pending"
    }).execute()
    
    # 2. Ingest a document for this task
    doc_id = str(uuid.uuid4())
    print(f"Ingesting doc for task: {doc_id}")
    ingest_req = RAGIngestRequest(
        doc_id=doc_id,
        text="This is a test document for cascading deletion. Chunks should be removed when task is deleted.",
        metadata={"title": "Cascade Test Doc", "org_id": org_id, "task_id": task_id},
        org_id=org_id,
        task_id=task_id
    )
    res = await rag_ingest(ingest_req)
    print(f"Ingest Result: {json.dumps(res, indent=2)}")
    
    # 3. Verify existence
    print("Verifying existence in DB...")
    d_check = await supabase.table("documents").select("id").eq("id", doc_id).execute()
    c_check = await supabase.table("document_chunks").select("id").eq("document_id", doc_id).execute()
    t_check = await supabase.table("tasks").select("id").eq("id", task_id).execute()
    
    print(f"Counts - D: {len(d_check.data)}, C: {len(c_check.data)}, T: {len(t_check.data)}")
    
    if d_check.data and c_check.data and t_check.data:
        print("✅ Pre-deletion verification SUCCESS: Task and Docs exist.")
    else:
        print(f"❌ Pre-deletion verification FAILURE.")
        # Don't return, let's see if we can still try to delete what we have
        if not t_check.data: return

    # 4. Perform Delete via SLM Mutation
    print("\nTriggering delete_task mutation...")
    class MockBackgroundTasks:
        def add_task(self, func, *args, **kwargs): pass

    slm_req = SLMQueryRequest(
        query=f"Delete the task with ID {task_id}",
        user_id='080c98f8-b391-4990-9382-83951efb1c91', # Manager ID
        org_id=org_id,
        user_role='manager',
        is_confirmed=True,
        pending_action='delete_task',
        pending_params={'task_id': task_id}
    )
    resp = await slm_chat(slm_req, MockBackgroundTasks())
    print(f"Chatbot Response: {resp.response}")

    # 5. Verify Cleanup
    print("\nVerifying cascading cleanup...")
    d_after = await supabase.table("documents").select("id").eq("id", doc_id).execute()
    c_after = await supabase.table("document_chunks").select("id").eq("document_id", doc_id).execute()
    t_after = await supabase.table("tasks").select("id").eq("id", task_id).execute()
    
    if not d_after.data and not c_after.data and not t_after.data:
        print("✅ CASCADING DELETE SUCCESS: All resources removed.")
    else:
        print(f"❌ CASCADING DELETE FAILURE: D:{len(d_after.data)} C:{len(c_after.data)} T:{len(t_after.data)}")

asyncio.run(test_cascade())
