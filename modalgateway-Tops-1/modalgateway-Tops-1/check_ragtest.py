"""Verify RAGTEST now gets proper answers"""
import requests

resp = requests.post('http://localhost:8035/slm/chat', json={
    'query': 'what is RAGTEST document about',
    'user_id': 'test-user',
    'org_id': 'dde0a075-5eb3-4b4b-8de3-0a6b1162951f',
    'project_id': '833ab297-26fb-4c33-a90d-92a6cf3e76f5',
    'user_role': 'employee',
    'app_name': 'talentops',
    'context': {'route': '/employee-dashboard/documents', 'module': 'documents', 'role': 'employee', 'org_id': 'dde0a075-5eb3-4b4b-8de3-0a6b1162951f'}
}, timeout=90)

data = resp.json()
response_text = data.get('response', '')
print(f"ACTION: {data.get('action')}")
print(f"RESPONSE:\n{response_text}")
print(f"\nLength: {len(response_text)} chars")

has_deny = 'does not specify' in response_text.lower() or 'does not contain' in response_text.lower()
print(f"\nDENIAL CHECK: {'STILL BROKEN ❌' if has_deny else 'FIXED ✅'}")
