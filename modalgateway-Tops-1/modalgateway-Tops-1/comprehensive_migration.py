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

async def migrate():
    print("\n" + "="*80)
    print("🚀 COMPREHENSIVE RAG METADATA MIGRATION")
    print("="*80)
    
    target_org = 'dde0a075-5eb3-4b4b-8de3-0a6b1162951f'
    target_proj = '833ab297-c466-41f2-8e10-be550787e220'
    
    # 1. Fetch all documents for this organization
    d_res = await supabase.table("documents").select("*").eq("org_id", target_org).execute()
    docs = d_res.data or []
    
    print(f"Total documents found in Org: {len(docs)}")
    
    migrated_count = 0
    for d in docs:
        d_id = d.get('id')
        title = d.get('title')
        source = d.get('source')
        current_proj = d.get('project_id')
        
        # Determine if this should be migrated:
        # Migrating if:
        # - It is NOT a policy (source != 'policy')
        # - AND it is not already in the target project
        
        is_policy = (source == 'policy') or ('policy' in str(title).lower() and 'proxy' not in str(title).lower())
        
        if not is_policy and current_proj != target_proj:
            print(f"📦 Migrating: '{title}' -> Project ID: {target_proj}")
            
            # Update Document
            upd_res = await supabase.table("documents").update({"project_id": target_proj}).eq("id", d_id).execute()
            
            # Update Chunks (redundant but safe for isolation)
            await supabase.table("document_chunks").update({"project_id": target_proj}).eq("document_id", d_id).execute()
            
            migrated_count += 1

    print(f"\n✅ Migration Complete. Updated {migrated_count} documents.")
    print("="*80 + "\n")

asyncio.run(migrate())
