import asyncio, os, sys, json
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

async def audit():
    target_org = 'dde0a075-5eb3-4b4b-8de3-0a6b1162951f'
    d_res = await supabase.table("documents").select("*").eq("org_id", target_org).execute()
    docs = d_res.data or []
    
    results = []
    for d in docs:
        d_id = d.get('id')
        c_res = await supabase.table("document_chunks").select("id").eq("document_id", d_id).execute()
        d['chunk_count'] = len(c_res.data or [])
        results.append(d)
    
    with open('audit_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    print("DONE")

asyncio.run(audit())
