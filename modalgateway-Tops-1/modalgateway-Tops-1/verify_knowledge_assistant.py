import requests
import json

BASE_URL = "http://localhost:8035/slm/chat"
ORG_ID = "dde0a075-5eb3-4b4b-8de3-0a6b1162951f"
PROJECT_ID = "833ab297-26fb-4c33-a90d-92a6cf3e76f5"

def ask_bot(query):
    payload = {
        "query": query,
        "user_id": "test_user",
        "org_id": ORG_ID,
        "project_id": PROJECT_ID,
        "user_role": "employee",
        "app_name": "talentops",
        "context": {
            "route": "/employee-dashboard/documents",
            "module": "documents",
            "role": "employee",
            "org_id": ORG_ID
        }
    }
    response = requests.post(BASE_URL, json=payload)
    return response.json()

print("-" * 50)
print("TEST 1: General Concept Question ('What is RAG?')")
print("-" * 50)
resp1 = ask_bot("What is RAG?")
print(f"Response: {resp1.get('response')}")
is_general = "retrieval-augmented generation" in resp1.get('response', '').lower()
has_system_info = "talentops" in resp1.get('response', '').lower() or "platform" in resp1.get('response', '').lower()
print(f"Correct General Explanation: {'YES' if is_general else 'NO'}")
print(f"No Private System Info: {'YES' if not has_system_info else 'NO'}")

print("\n" + "-" * 50)
print("TEST 2: Document-Specific Question (Missing Info in RAGTEST)")
print("-" * 50)
resp2 = ask_bot("Who is the CEO mentioned in the @RAGTEST document?")
print(f"Response: {resp2.get('response')}")
is_refusal = "the document does not specify this information" in resp2.get('response', '').lower()
print(f"Strict Denial Format: {'YES' if is_refusal else 'NO'}")

print("\n" + "-" * 50)
print("TEST 3: Document-Specific Question (Present Info in RAGTEST)")
print("-" * 50)
resp3 = ask_bot("What tables are mentioned in the @RAGTEST document?")
print(f"Response: {resp3.get('response')[:200]}...")
has_tables = "project_documents" in resp3.get('response', '').lower() or "create table" in resp3.get('response', '').lower()
print(f"Grounded in Context: {'YES' if has_tables else 'NO'}")
