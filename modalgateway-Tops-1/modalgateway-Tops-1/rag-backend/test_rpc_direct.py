import requests
import json

def test_manual_rpc():
    print("--- TESTING RPC CALL DIRECTLY ---")
    
    # 1. Get embedding for "roles and permissions" from a chunk we KNOW exists
    #    (from our previous inspect step, we saw: "4.9 Settings & Integrations... Roles & permission editor")
    
    # Simulate embedding (this is just random noise if we don't have the model, BUT
    # we can fetch the ACTUAL embedding from the DB for a chunk and query with it to guarantee a 1.0 match)
    
    # Fetch embedding of the first chunk of SLM Doc
    url_chunk = "http://localhost:8040/health" # Just check server is up
    
    # Use inspect_embedding logic to get a REAL vector
    import os
    from dotenv import load_dotenv
    load_dotenv()
    
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    # Fetch one embedding
    doc_id = 'b3a138aa-72c9-4890-a65b-85346c195bf5'
    url = f"{SUPABASE_URL}/rest/v1/document_chunks?document_id=eq.{doc_id}&limit=1&select=embedding,org_id,project_id"
    resp = requests.get(url, headers=headers)
    data = resp.json()
    
    if not data:
        print("No chunks found to test with.")
        return

    real_embedding = json.loads(data[0]['embedding'])
    org_id = data[0]['org_id']
    project_id = data[0]['project_id']
    
    print(f"Got real embedding size: {len(real_embedding)}")
    print(f"Org: {org_id}, Proj: {project_id}")

    # Now call the RPC manually
    rpc_payload = {
        "query_embedding": real_embedding,
        "match_threshold": 0.1, # EXTREMELY LOW threshold
        "match_count": 5,
        "filter": {
            "org_id": org_id,
            "project_id": project_id
        }
    }
    
    print("Calling match_documents RPC...")
    r = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/match_documents", headers=headers, json=rpc_payload)
    
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text}")

if __name__ == "__main__":
    test_manual_rpc()
