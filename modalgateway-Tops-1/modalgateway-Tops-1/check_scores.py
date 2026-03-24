import asyncio
import os
import json
from dotenv import load_dotenv
load_dotenv()
from binding import supabase, init_db, get_embeddings

async def test_scores():
    init_db(
        os.getenv('TALENTOPS_SUPABASE_URL'),
        os.getenv('TALENTOPS_SUPABASE_SERVICE_ROLE_KEY'),
        os.getenv('COHORT_SUPABASE_URL'),
        os.getenv('COHORT_SUPABASE_SERVICE_ROLE_KEY')
    )
    from openai import AsyncOpenAI
    openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    from binding import init_rag
    init_rag(openai_client)
    
    queries = ["list out the policies for me", "policies", "policy", "leave policy", "performance"]
    org_id = "dde0a075-5eb3-4b4b-8de3-0a6b1162951f"
    
    for query in queries:
        print(f"\nQuery: '{query}'")
        emb_res = await get_embeddings([query])
        q_emb, _ = emb_res
        
        if not q_emb:
            print("Failed to get embeddings.")
            continue
            
        params = {
            "query_embedding": q_emb[0],
            "match_threshold": 0.0, # Get EVERYTHING
            "match_count": 5
        }
        
        rpc_resp = await supabase.rpc("match_documents", params)
        matches = rpc_resp.data or []
        
        if not matches:
            print("No matches found even with 0.0 threshold.")
        else:
            for i, m in enumerate(matches):
                print(f"  Match {i+1}: Score={m.get('similarity')}, Content='{m.get('content')[:50]}...'")

if __name__ == "__main__":
    asyncio.run(test_scores())
