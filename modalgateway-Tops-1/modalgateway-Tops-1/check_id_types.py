import os
import requests
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("TALENTOPS_SUPABASE_URL")
key = os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

def get_table_info(table_name):
    # This query uses the PostgREST introspection to get column types
    # Note: This might not work if the user doesn't have permissions or if it's disabled
    # but usually works for service role
    query = f"select=column_name,data_type"
    # Actually, a better way is to hit the OpenAPI spec or just guess from a sample
    # But let's try to query the information_schema via RPC if possible, 
    # but wait, I can just try to insert a UUID and see if it fails with type error.
    
    # Let's try to get one row and check the type of 'id' programmatically
    resp = requests.get(f"{url}/rest/v1/{table_name}?select=id", headers=headers, params={"limit": 1})
    if resp.status_code == 200:
        data = resp.json()
        if data:
            val = data[0]['id']
            print(f"Table {table_name}: sample id value = {val}, type = {type(val)}")
        else:
            print(f"Table {table_name}: No data")
    else:
        print(f"Table {table_name}: Error {resp.status_code}")

print("Checking ID types...")
get_table_info("project_documents")
get_table_info("documents")
