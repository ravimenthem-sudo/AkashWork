import asyncio
import os
import json
import time
import sys
from dotenv import load_dotenv

# Ensure stdout uses utf-8
if sys.stdout.encoding != 'utf-8':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
from binding import SLMQueryRequest, init_db, select_client, init_rag
from unified_server import slm_chat, rag_query
from openai import AsyncOpenAI

load_dotenv()

async def test_task_retrieval():
    print("Testing Task Document Retrieval with Hints...")
    
    init_db(
        os.getenv("TALENTOPS_SUPABASE_URL"),
        os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")
    )
    # RAG utils need an AsyncOpenAI client
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    init_rag(client)

    # Use a real org_id from the DB
    org_id = "dde0a075-5eb3-4b4b-8de3-0a6b1162951f"
    
    # Query mentions "requirement refiner"
    req = SLMQueryRequest(
        query="what is the requirement refiner document contains?",
        user_id="e2a8c3e1-3b4e-4b4e-9b4e-4e4e4e4e4e4e",
        org_id=org_id,
        app_name="talentops"
    )
    
    print(f"Query: '{req.query}'")
    
    try:
        # We need a mock background_tasks
        class MockBG:
            def add_task(self, *args, **kwargs): pass
        
        resp = await slm_chat(req, MockBG())
        print("\n--- Response ---")
        print(resp.response)
        
        if "No relevant document sections" not in resp.response and "does not specify" not in resp.response.lower():
            print("\n✅ SUCCESS: Content retrieved semantically (likely via hint)!")
        else:
            print("\n❌ FAILED: Content NOT retrieved.")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_task_retrieval())
