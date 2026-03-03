import requests
import json

BASE_URL = "http://localhost:8035"

ROLES_TESTS = {
    "employee": [
        ("show me the announcements which are completed", "Viewing Announcements"),
        ("show my tasks", "Tasks"),
        ("check in", "Attendance")
    ],
    "manager": [
        ("list team tasks", "Team Tasks"),
        ("show pending leaves", "Leave Management")
    ],
    "executive": [
        ("post a message to everyone", "Posting Announcement (Should fail if user is employee)"),
        ("finance summary", "Finance Overview")
    ]
}

def run_comprehensive_tests():
    print("=== COMPREHENSIVE ROLE-BASED ACTION TEST (ASCII ONLY) ===\n")
    
    for role, tests in ROLES_TESTS.items():
        print(f"\n[ROLE: {role.upper()}]")
        for query, desc in tests:
            payload = {
                "query": query,
                "context": {
                    "role": role,
                    "user_id": f"test_{role}_123",
                    "route": "/dashboard"
                }
            }
            try:
                response = requests.post(f"{BASE_URL}/api/chatbot/query", json=payload)
                if response.status_code == 200:
                    data = response.json()
                    answer = data.get("answer", "")
                    
                    status = "PASS"
                    if "not authorized" in answer.lower() and role != "employee":
                        status = "REJECTED (Correct if not Executive)"
                    elif "not authorized" in answer.lower() and role == "employee" and "announcement" in query:
                         status = "BUG: Refused viewing announcement"
                    
                    print(f"  > '{query}' ({desc}): {status}")
                    print(f"    Response: {answer[:100]}...")
                else:
                    print(f"  > '{query}': ERROR {response.status_code}")
            except Exception as e:
                print(f"  > '{query}': EXCEPTION {e}")

if __name__ == "__main__":
    run_comprehensive_tests()
