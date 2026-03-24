import asyncio
import os
from dotenv import load_dotenv
from binding import supabase, init_db, select_client, get_embeddings, init_rag
from openai import AsyncOpenAI

load_dotenv()

async def check_requirement_refiner_scores():
    print("Checking scores for 'requirement refiner'...")
    init_db(
        os.getenv("TALENTOPS_SUPABASE_URL"),
        os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")
    )
    select_client("talentops")
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    init_rag(client)

    org_id = "dde0a075-5eb3-4b4b-8de3-0a6b1162951f"
    
    queries = [
        "requirement refiner",
        "explain requirement refiner",
        "what is in the requirement refiner document",
        "requirement refiner document contains?"
    ]
    
    for query in queries:
        print(f"\nQuery: '{query}'")
        emb_res = await get_embeddings([query])
        q_emb, _ = emb_res
        
        params = {
            "query_embedding": q_emb[0],
            "match_threshold": 0.0, # Get EVERYTHING
            "match_count": 5,
            "filter": {"org_id": org_id}
        }
        
        rpc_resp = await supabase.rpc("match_documents", params)
        matches = rpc_resp.data if rpc_resp.data else []
        
        print(f"Found {len(matches)} matches (0.0 threshold):")
        for i, m in enumerate(matches):
            print(f"  {i+1}. Score={m.get('similarity'):.3f}, Content='{m.get('content')[:100]}...'")

if __name__ == "__main__":
    asyncio.run(check_requirement_refiner_scores())
