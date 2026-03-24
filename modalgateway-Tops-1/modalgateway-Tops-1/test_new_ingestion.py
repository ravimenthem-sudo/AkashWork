import asyncio
import os
import requests
import uuid
from dotenv import load_dotenv

load_dotenv()

async def test_new_ingestion():
    url = os.getenv("TALENTOPS_SUPABASE_URL")
    key = os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")
    server_url = "http://localhost:8035/rag/ingest"
    
    org_id = "dde0a075-5eb3-4b4b-8de3-0a6b1162951f"
    project_id = "ec74befd-a363-4873-80ad-0c8507c6325c"
    task_id = str(uuid.uuid4()) # Fresh task ID for testing
    phase = "verify_phase"
    doc_id = str(uuid.uuid4())

    payload = {
        "doc_id": doc_id,
        "org_id": org_id,
        "project_id": project_id,
        "task_id": task_id,
        "phase": phase,
        "text": "This is a test document to verify metadata propagation for task IDs and phases.",
        "metadata": {
            "title": "Ingestion Verification Document"
        },
        "app_name": "talentops"
    }

    print(f"Ingesting new document with task_id={task_id} and phase={phase}...")
    r = requests.post(server_url, json=payload)
    print(f"Response: {r.json()}")

    if r.json().get("success"):
        print("\nVerifying chunks in database...")
        # Check document_chunks table
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        check_url = f"{url}/rest/v1/document_chunks?document_id=eq.{doc_id}&select=task_id,phase"
        rc = requests.get(check_url, headers=headers)
        chunks = rc.json()
        
        if chunks:
            chunk = chunks[0]
            print(f"Chunk metadata: task_id={chunk.get('task_id')}, phase={chunk.get('phase')}")
            if chunk.get('task_id') == task_id and chunk.get('phase') == phase:
                print("\n✅ SUCCESS: Metadata correctly propagated to chunks!")
            else:
                print("\n❌ FAILED: Metadata mismatch in chunks.")
        else:
            print("\n❌ FAILED: No chunks found.")

if __name__ == "__main__":
    asyncio.run(test_new_ingestion())
