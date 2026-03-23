import asyncio, os, sys, json
sys.path.insert(0, r'd:\chatbot\AkashWork\modalgateway-Tops-1\modalgateway-Tops-1')
from dotenv import load_dotenv
load_dotenv(r'd:\chatbot\AkashWork\modalgateway-Tops-1\modalgateway-Tops-1\.env')
from binding import supabase, init_db

# Setup stdout for UTF-8
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

init_db(
    os.getenv('TALENTOPS_SUPABASE_URL'),
    os.getenv('TALENTOPS_SUPABASE_SERVICE_ROLE_KEY'),
    os.getenv('COHORT_SUPABASE_URL'),
    os.getenv('COHORT_SUPABASE_SERVICE_ROLE_KEY')
)

async def check():
    print("DOCUMENTS ID AUDIT:")
    res = await supabase.table('documents').select('id, title, org_id, project_id, task_id').execute()
    docs = res.data or []
    
    # User's active session IDs (from logs)
    user_org = 'dde0a075-5eb3-4b4b-8de3-0a6b1162951f'
    user_proj = '833ab297-c466-41f2-8e10-be550787e220'
    
    print(f"USER SESSION: Org={user_org}, Proj={user_proj}\n")
    
    for d in docs:
        match_org = (d.get('org_id') == user_org)
        match_proj = (d.get('project_id') == user_proj)
        is_global = (d.get('project_id') is None)
        
        status = "✅ MATCH" if (match_org and (match_proj or is_global)) else "❌ MISMATCH"
        if not match_org:
            status = "❌ ORG MISMATCH"
        
        print(f"[{status}] {d['title'][:30]:<30} | Org: {d.get('org_id')} | Proj: {d.get('project_id')}")

asyncio.run(check())
