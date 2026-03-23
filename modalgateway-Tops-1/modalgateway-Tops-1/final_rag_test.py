import asyncio, os, sys, json
sys.path.insert(0, r'd:\chatbot\AkashWork\modalgateway-Tops-1\modalgateway-Tops-1')
from dotenv import load_dotenv
load_dotenv(r'd:\chatbot\AkashWork\modalgateway-Tops-1\modalgateway-Tops-1\.env')
from binding import supabase, init_db, RAGQueryRequest
from unified_server import rag_query

init_db(
    os.getenv('TALENTOPS_SUPABASE_URL'),
    os.getenv('TALENTOPS_SUPABASE_SERVICE_ROLE_KEY'),
    os.getenv('COHORT_SUPABASE_URL'),
    os.getenv('COHORT_SUPABASE_SERVICE_ROLE_KEY')
)

async def test():
    # Test 1: RAGTEST
    req1 = RAGQueryRequest(
        question="explain the ragtest document",
        org_id='dde0a075-5eb3-4b4b-8de3-0a6b1162951f',
        project_id='833ab297-c466-41f2-8e10-be550787e220',
        app_name='talentops'
    )
    resp1 = await rag_query(req1)
    print(f"RAGTEST Match: {bool(resp1.get('answer'))} | Sources: {resp1.get('sources')}")

    # Test 2: Supabase (Architecture/Backend)
    req2 = RAGQueryRequest(
        question="explain the supabase backend document", # Matching query from screenshot
        org_id='dde0a075-5eb3-4b4b-8de3-0a6b1162951f',
        project_id='833ab297-c466-41f2-8e10-be550787e220',
        app_name='talentops'
    )
    resp2 = await rag_query(req2)
    print(f"Supabase Match: {bool(resp2.get('answer'))} | Sources: {resp2.get('sources')}")

asyncio.run(test())
