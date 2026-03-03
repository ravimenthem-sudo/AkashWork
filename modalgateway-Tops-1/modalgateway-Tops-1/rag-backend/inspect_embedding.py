import os
import requests
from dotenv import load_dotenv
import json
import numpy as np

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def inspect_embedding():
    print("--- INSPECTING EMBEDDING VECTOR ---")
    # Fetch 1 chunk strictly matching our target
    project_id = '11d82a1c-f4fe-4249-b8b0-ce61166c2f43'
    org_id = '66bed17d-978f-43c7-8b63-3a4c3e331efb'
    
    url = f"{SUPABASE_URL}/rest/v1/document_chunks?project_id=eq.{project_id}&org_id=eq.{org_id}&limit=1&select=embedding"
    resp = requests.get(url, headers=headers)
    
    if resp.status_code != 200:
        print(f"Error fetching: {resp.text}")
        return

    data = resp.json()
    if not data:
        print("No chunks found with matching IDs!")
        return

    vec_str = data[0]['embedding'] # It comes as a string "[0.1, ...]"
    # Parse json if it's a string, or it might be a list already from requests json decoder
    try:
        vec = json.loads(vec_str) if isinstance(vec_str, str) else vec_str
        print(f"Vector Type: {type(vec)}")
        print(f"Vector Length: {len(vec)}")
        print(f"First 5 values: {vec[:5]}")
        
        # Check if it's all zeros
        arr = np.array(vec)
        print(f"Max Value: {arr.max()}")
        print(f"Min Value: {arr.min()}")
        print(f"Norm (Length): {np.linalg.norm(arr)}") # Should be close to 1.0 for OpenAI
        
        if np.allclose(arr, 0):
            print("ALERT: Vector is all zeros!")
            
    except Exception as e:
        print(f"Error parsing vector: {e}")
        print(f"Raw content: {vec_str}")

if __name__ == "__main__":
    inspect_embedding()
