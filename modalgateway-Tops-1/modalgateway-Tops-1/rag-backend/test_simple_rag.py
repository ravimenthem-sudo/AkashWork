import requests
import json
import time

def test_rag():
    print("--- TESTING RAG WITH SIMPLE TEXT ---")
    
    # 1. Ingest
    payload = {
        "doc_id": "123e4567-e89b-12d3-a456-426614174000",
        "org_id": "66bed17d-978f-43c7-8b63-3a4c3e331efb",
        "project_id": "11d82a1c-f4fe-4249-b8b0-ce61166c2f43",
        "text": "Antigravity is the codename for the advanced AI agent created by Google DeepMind. It specializes in coding and debugging complex systems.",
        "metadata": {"title": "Test Doc"}
    }
    
    try:
        r = requests.post("http://localhost:8040/docs/ingest", json=payload)
        print(f"Ingest Status: {r.status_code}")
        print(f"Ingest Response: {r.text}")
    except Exception as e:
        print(f"Ingest Failed: {e}")
        return

    time.sleep(2) # Wait for db

    # 2. Query
    q_payload = {
        "question": "What is Antigravity?",
        "org_id": "66bed17d-978f-43c7-8b63-3a4c3e331efb",
        "project_id": "11d82a1c-f4fe-4249-b8b0-ce61166c2f43"
    }
    
    try:
        r = requests.post("http://localhost:8040/query", json=q_payload)
        print(f"Query Status: {r.status_code}")
        print(f"Query Response: {r.text}")
    except Exception as e:
        print(f"Query Failed: {e}")

if __name__ == "__main__":
    test_rag()
