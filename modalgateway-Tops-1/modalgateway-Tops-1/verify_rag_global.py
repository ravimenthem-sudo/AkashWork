import asyncio
import os
from dotenv import load_dotenv
from binding import supabase, init_db, select_client, get_embeddings, init_rag

load_dotenv()

# Mock OpenAI client
class MockOpenAI:
    def __init__(self):
        self.embeddings = self.Embeddings()
        
    class Embeddings:
        async def create(self, input, model, timeout=10):
            # Return some fake but correctly shaped data
            import random
            mock_emb = [random.uniform(-0.1, 0.1) for _ in range(1536)]
            
            class Data:
                def __init__(self, emb):
                    self.embedding = emb
            
            class Resp:
                def __init__(self, data_list):
                    self.data = data_list
            
            return Resp([Data(mock_emb) for _ in input])

async def test_rag_global_retrieval():
    print("🧪 Testing RAG Global Policy Retrieval (with Mock Embeddings)...")
    
    init_db(
        os.getenv("TALENTOPS_SUPABASE_URL"),
        os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")
    )
    select_client("talentops")
    
    # Initialize RAG with mock client
    mock_client = MockOpenAI()
    init_rag(mock_client)
    
    # Target: "Leave Policy"
    test_project_id = "11d82a1c-f4fe-4249-b8b0-ce61166c2f43" # Mock Project
    org_id = "dde0a075-5eb3-4b4b-8de3-0a6b1162951f"
    
    question = "What is the Leave Policy?"
    print(f"Question: '{question}'")
    
    try:
        # Use a real embedding if we can, but since it's a mock, we'll just get a random vector
        # This tests the SQL logic by passing a project_id and seeing if NULL project_id chunks return.
        
        q_emb, _ = await get_embeddings([question])
        
        # Call RPC
        params = {
            "query_embedding": q_emb[0],
            "match_threshold": -1.0, # match everything to see if filtering works
            "match_count": 10,
            "filter": {
                "org_id": org_id,
                "project_id": test_project_id
            }
        }
        
        rpc_resp = await supabase.rpc("match_documents", params)
        matches = rpc_resp.data if rpc_resp.data else []
        
        print(f"✅ Found {len(matches)} vector matches")
        
        if matches:
            # Check for global vs project docs
            doc_ids = list(set([m.get('id') for m in matches]))
            meta_res = await supabase.table("documents").select("id, title, project_id").in_("id", doc_ids).execute()
            meta_map = {d['id']: d for d in meta_res.data}
            
            has_global = False
            has_project = False
            
            for m in matches:
                doc_meta = meta_map.get(m.get('id'))
                if doc_meta:
                    p_id = doc_meta.get('project_id')
                    status = "GLOBAL" if not p_id else f"PROJECT ({p_id})"
                    print(f"   [{status}] {doc_meta.get('title')}")
                    if not p_id: has_global = True
                    if p_id == test_project_id: has_project = True
            
            if has_global:
                print("✨ SUCCESS: Global documents correctly matched alongside project documents!")
            else:
                print("❌ FAILED: Only project documents matched (or no docs).")
        else:
            print("❌ Test FAILED: No matches found.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_rag_global_retrieval())
