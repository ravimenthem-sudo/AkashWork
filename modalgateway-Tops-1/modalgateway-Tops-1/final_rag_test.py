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
    # Set encoding for Windows terminal
    if sys.platform == 'win32':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    print("\n--- FINAL VERIFICATION: CATEGORIZED INVENTORY ---")
    req = RAGQueryRequest(
        question="What documents are available?",
        org_id='dde0a075-5eb3-4b4b-8de3-0a6b1162951f',
        project_id='833ab297-c466-41f2-8e10-be550787e220',
        app_name='talentops'
    )
    resp = await rag_query(req)
    
    answer = resp.get('answer', '')
    print("--- INVENTORY START ---")
    print(answer)
    print("--- INVENTORY END ---")
    
    if "COMPANY POLICIES (Total: 7)" in answer:
        print("\n✅ SUCCESS: Found exactly 7 policies.")
    else:
        print(f"\n❌ FAILURE: Policy count mismatch. Header not found or different count.")

    if "PROJECT DOCUMENTS" in answer:
        print("✅ SUCCESS: Found Project Documents section.")
    else:
        print("❌ FAILURE: Project Documents section missing.")

asyncio.run(test())
