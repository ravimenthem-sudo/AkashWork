import os
import requests
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ORG_ID = "dde0a075-5eb3-4b4b-8de3-0a6b1162951f"

client = OpenAI(api_key=OPENAI_API_KEY)

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def get_embedding(text):
    resp = client.embeddings.create(input=[text], model="text-embedding-3-small")
    return resp.data[0].embedding

def discover_rpc_params(query):
    emb = get_embedding(query)
    
    # Let's try to pass the org ID in various common parameter names
    # AND use a very low threshold
    variations = [
        {"query_embedding": emb, "match_threshold": 0.001, "match_count": 5, "filter": ORG_ID},
        {"query_embedding": emb, "match_threshold": 0.001, "match_count": 5, "org_id_filter": ORG_ID},
        {"query_embedding": emb, "match_threshold": 0.001, "match_count": 5, "p_org_id": ORG_ID}
    ]
    
    for i, params in enumerate(variations):
        print(f"\nAttempt {i+1} with {list(params.keys())}")
        url = f"{SUPABASE_URL}/rest/v1/rpc/match_documents"
        resp = requests.post(url, headers=headers, json=params)
        if resp.status_code == 200:
            data = resp.json()
            print(f"Result count: {len(data)}")
            if data:
                print(f"First match org_id: {data[0].get('org_id')}")
        else:
            print(f"Error {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    discover_rpc_params("SLM Test Doc")
