import requests
import json
import time

BASE_URL = "http://localhost:8035/slm/chat"
ORG_ID = "dde0a075-5eb3-4b4b-8de3-0a6b1162951f"
PROJECT_ID = "833ab297-26fb-4c33-a90d-92a6cf3e76f5"

def ask_bot(query, history=None):
    payload = {
        "query": query,
        "user_id": "test_user",
        "org_id": ORG_ID,
        "project_id": PROJECT_ID,
        "user_role": "employee",
        "app_name": "talentops",
        "history": history or [],
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
print("TEST 1: Initial Question about Specific Document")
print("-" * 50)
resp1 = ask_bot("What tables are mentioned in the RAGTEST document?")
print(f"User: What tables are mentioned in the RAGTEST document?")
print(f"Bot: {resp1.get('response')[:200]}...")

history = [
    {"role": "user", "content": "What tables are mentioned in the RAGTEST document?"},
    {"role": "assistant", "content": resp1.get('response')}
]

print("\n" + "-" * 50)
print("TEST 2: Contextual Follow-up ('How many?')")
print("-" * 50)
resp2 = ask_bot("How many tables?", history=history)
print(f"User: How many tables?")
# We expect the bot to NOT say "The document does not specify"
print(f"Bot: {resp2.get('response')}")
is_success = "the document does not specify" not in resp2.get('response', '').lower()
print(f"Result: {'SUCCESS' if is_success else 'FAILURE'}")

history.append({"role": "user", "content": "How many layers?"})
history.append({"role": "assistant", "content": resp2.get('response')})

print("\n" + "-" * 50)
print("TEST 3: Topic Change ('What is RAG?')")
print("-" * 50)
# This should NOT be rewritten to include "RAGTEST document"
resp3 = ask_bot("What is RAG?", history=history)
print(f"User: What is RAG?")
print(f"Bot: {resp3.get('response')}")
# Check if "RAGTEST" is mentioned in the response (it shouldn't be if it's a fresh query)
has_context_bleed = "ragtest" in resp3.get('response', '').lower()
print(f"No Context Bleed: {'YES' if not has_context_bleed else 'NO'}")
