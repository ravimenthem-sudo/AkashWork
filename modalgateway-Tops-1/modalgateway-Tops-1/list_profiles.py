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

async def check():
    print("PROJECTS TABLE:")
    res = await supabase.table('projects').select('id, name').execute()
    projects = res.data or []
    for p in projects:
        print(f"  {p['id']} | {p['name']}")

    print("\nLOOKING FOR TARGET USER: ec74befb-a363-4873-80ad-0c8507c80571")
    target_user = 'ec74befb-a363-4873-80ad-0c8507c80571'
    u_res = await supabase.table('profiles').select('*').eq('id', target_user).execute()
    if u_res.data:
        print(f"  Found in profiles: {u_res.data[0]}")
    else:
        print("  NOT found in profiles.")
    
    # Check by user_id column too
    u_res_uid = await supabase.table('profiles').select('*').eq('user_id', target_user).execute()
    if u_res_uid.data:
        print(f"  Found in profiles (user_id col): {u_res_uid.data[0]}")

    print("\nLOOKING FOR TARGET PROJECT from LOGS: 833ab297-c466-41f2-8e10-be550787e220")
    target_proj = '833ab297-c466-41f2-8e10-be550787e220'
    p_res = await supabase.table('projects').select('*').eq('id', target_proj).execute()
    if p_res.data:
        print(f"  Found in projects: {p_res.data[0]}")
    else:
        print("  NOT found in projects.")

    print("\nLOOKING FOR TARGET ORG from LOGS: 24cc21be-ac8f-4d33-9130-1090333be143")
    target_org = '24cc21be-ac8f-4d33-9130-1090333be143'
    # Check organizations table if it exists
    try:
        o_res = await supabase.table('organizations').select('*').eq('id', target_org).execute()
        if o_res.data:
            print(f"  Found in organizations: {o_res.data[0]}")
        else:
            print("  NOT found in organizations.")
    except:
        print("  Organizations table not found/accessible.")

asyncio.run(check())
