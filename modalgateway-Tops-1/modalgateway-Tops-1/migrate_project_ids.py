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
    print("🚀 Starting Corrected Project ID Migration...")
    
    # User's active session ID
    target_proj = '833ab297-c466-41f2-8e10-be550787e220'
    
    # All documents in the mismatched projects
    # Based on audit: 833ab297-26fb-4c33-a90d-92a6cf3e76f5 AND a4610dc8-6487-4789-96c0-98b35017f596
    mismatched_projs = [
        '833ab297-26fb-4c33-a90d-92a6cf3e76f5',
        'a4610dc8-6487-4789-96c0-98b35017f596'
    ]
    
    for old_proj in mismatched_projs:
        print(f"Updating documents from {old_proj} to {target_proj}...")
        d_res = await supabase.table('documents').update({'project_id': target_proj}).eq('project_id', old_proj).execute()
        print(f"  Updated {len(d_res.data or [])} documents.")

    print("✅ Corrected Migration Complete.")

asyncio.run(migrate())
