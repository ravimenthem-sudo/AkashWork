import asyncio, os, sys
sys.path.insert(0, r'd:\chatbot\AkashWork\modalgateway-Tops-1\modalgateway-Tops-1')
from dotenv import load_dotenv
load_dotenv(r'd:\chatbot\AkashWork\modalgateway-Tops-1\modalgateway-Tops-1\.env')
from binding import supabase, init_db, init_rag
from openai import AsyncOpenAI
# Setup stdout to handle UTF-8
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

init_db(os.getenv('TALENTOPS_SUPABASE_URL'), os.getenv('TALENTOPS_SUPABASE_SERVICE_ROLE_KEY'), os.getenv('COHORT_SUPABASE_URL'), os.getenv('COHORT_SUPABASE_SERVICE_ROLE_KEY'))
init_rag(AsyncOpenAI(api_key=os.getenv('OPENAI_API_KEY')))

async def check():
    # 1. Check User Profile
    user_id = 'ec74befb-a363-4873-80ad-0c8507c80571' # From logs
    u_res = await supabase.table('profiles').select('id, full_name, org_id').eq('id', user_id).execute()
    user = u_res.data[0] if u_res.data else {}
    print(f"USER PROFILE: {user.get('full_name')} (ID={user.get('id')})")
    print(f"  Profile Org ID: {user.get('org_id')}")
    print("-" * 50)

    # 2. Check all Org IDs in documents table
    d_res = await supabase.table('documents').select('org_id', 'title').execute()
    orgs = {}
    for d in (d_res.data or []):
        oid = d['org_id']
        orgs[oid] = orgs.get(oid, 0) + 1
    
    print("ORGS IN DOCUMENTS TABLE:")
    for oid, count in orgs.items():
        print(f"  {oid}: {count} documents")
    print("-" * 50)

    # 3. Check specific targets
    targets = ['RAGTEST', 'LLM Document', 'RAG Document', 'SLM Doc', 'Full Document']
    for name in targets:
        resp = await supabase.table('documents').select('id, title, org_id, project_id, task_id').ilike('title', f'%{name}%').execute()
        docs = resp.data or []
        for d in docs:
            doc_id = d['id']
            c_resp = await supabase.table('document_chunks').select('id, content').eq('document_id', doc_id).execute()
            chunks = c_resp.data or []
            print(f"\n[FOUND] '{d['title']}'")
            print(f"  Doc ID:     {doc_id}")
            print(f"  Org ID:     {d.get('org_id')}")
            print(f"  Proj ID:    {d.get('project_id')}")
            print(f"  Chunks:     {len(chunks)}")
            if user.get('org_id') != d.get('org_id'):
                print(f"  ⚠️ MISMATCH: This document belongs to Org {d.get('org_id')}, but user is in Org {user.get('org_id')}")
            for i, c in enumerate(chunks[:3]):
                content = c.get('content', '')
                print(f"  Chunk {i}: ({len(content)} chars) {content[:120]}...")

asyncio.run(check())
