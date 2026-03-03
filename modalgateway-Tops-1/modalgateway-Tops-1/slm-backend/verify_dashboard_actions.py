import requests
import json

BASE_URL = "http://localhost:8035/api/chatbot/query"

def test_action(query, role, user_id):
    payload = {
        "query": query,
        "context": {
            "role": role,
            "user_id": user_id,
            "page": "Dashboard"
        }
    }
    print(f"\n--- Testing [{role}]: '{query}' ---")
    response = requests.post(BASE_URL, json=payload)
    if response.status_code == 200:
        data = response.json()
        ans = data.get('answer', 'NO ANSWER')
        # Handle Windows terminal encoding issues
        try:
            print(f"Response: {ans}")
        except UnicodeEncodeError:
            print(f"Response: {ans.encode('ascii', 'replace').decode('ascii')}")
    else:
        print(f"Error {response.status_code}: {response.text}")

# Mock IDs for testing
EXECUTIVE_ID = "61e389df-162e-436d-9659-191cbba20456" # Pavan (Executive)
MANAGER_ID = "944a1bb3-21c6-4355-8dbf-19114dbeba42" # Vardhan (Manager)
EMPLOYEE_ID = "834ef91e-0158-4903-b09e-76e93d7c5f82" # Mohith (Employee)

# 1. Test Hiring Portal (Executive/Manager)
test_action("Show me the hiring portal", "executive", EXECUTIVE_ID)
test_action("Add candidate John Doe for Frontend role", "executive", EXECUTIVE_ID)

# 2. Test Audit Logs (Executive Only)
test_action("Show me the audit logs", "executive", EXECUTIVE_ID)
test_action("Show audit logs", "employee", EMPLOYEE_ID) # Should fail/deny

# 3. Test Team Hierarchy
test_action("Show team hierarchy", "manager", MANAGER_ID)

# 4. Test Dashboard Stats
test_action("What are the dashboard stats?", "employee", EMPLOYEE_ID)
test_action("Show analytics summary", "executive", EXECUTIVE_ID)
