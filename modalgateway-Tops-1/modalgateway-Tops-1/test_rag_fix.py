"""Test all 4 RAG fixes"""
import requests
import json

BASE = 'http://localhost:8035/slm/chat'
ORG = '833ab297-26fb-4c33-a90d-92a6cf3e76f5'

def ask(query, history=None):
    resp = requests.post(BASE, json={
        'query': query,
        'user_id': 'test-user',
        'org_id': ORG,
        'project_id': ORG,
        'user_role': 'employee',
        'app_name': 'talentops',
        'history': history or [],
        'context': {'route': '/employee-dashboard/documents', 'module': 'documents', 'role': 'employee', 'org_id': ORG}
    }, timeout=90)
    return resp.json()

print("=" * 60)
print("TEST 1: 'How many' question (should route to RAG)")
print("=" * 60)
r1 = ask("how many layers are there in the LLM document")
print(f"ACTION: {r1.get('action')}")
print(f"RESPONSE: {r1.get('response', '')[:300]}")
is_rag = r1.get('action') == 'present_rag'
has_clarify = 'clarify' in r1.get('response', '').lower() or "couldn't find" in r1.get('response', '').lower() or 'not quite sure' in r1.get('response', '').lower()
print(f"ROUTED TO RAG: {'PASS ✅' if is_rag else 'FAIL ❌'}")
print(f"NO CLARIFICATION ASK: {'PASS ✅' if not has_clarify else 'FAIL ❌'}")

print("\n" + "=" * 60)
print("TEST 4: Bot should NOT ask follow-up questions")
print("=" * 60)
response_text = r1.get('response', '')
follow_up_patterns = ['could you clarify', 'would you like', 'do you want me to', 'could you please', 'can you provide']
has_followup = any(p in response_text.lower() for p in follow_up_patterns)
print(f"NO FOLLOW-UP QUESTION: {'PASS ✅' if not has_followup else 'FAIL ❌'}")

print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"Fix 1 (how many routes to RAG): {'PASS ✅' if is_rag else 'FAIL ❌'}")
print(f"Fix 4 (no follow-up questions): {'PASS ✅' if not has_followup else 'FAIL ❌'}")
print(f"Fix 2-3 (context handling): Requires browser testing with chat history")
