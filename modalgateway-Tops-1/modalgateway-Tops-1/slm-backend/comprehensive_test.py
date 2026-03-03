import requests
import json

URL = "http://localhost:8035/chat"
USER_ID = "3fad4308-573f-4847-b904-2906fa67a468" # Real Profile ID

def test_action(role, message):
    payload = {
        "message": message,
        "role": role,
        "user_id": USER_ID,
        "team_id": "8324f923-5e75-4ae5-a1c1-987654321000" # Mock Team
    }
    try:
        resp = requests.post(URL, json=payload, timeout=30)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}

tests = {
    "Executive": [
        "Show me all company data (attendance, leaves)",
        "Add a new employee named John Doe with email john@example.com as manager",
        "Create a new department called 'Sales' and assign Vardhan as manager",
        "Approve Akbar's leave for next week",
        "Upload payslip for December 2025",
        "Post a company-wide announcement about the holiday party",
        "Configure system policies for 2026",
        "Give me AI insights on hiring performance"
    ],
    "Manager": [
        "Add an employee named Jane Smith to my department",
        "Approve Akbar's leave request",
        "Assign Teja as a Team Lead for our group",
        "Create a new team called 'Core Backend'",
        "Assign task 'Database Migration' to Vardhan for 2025-12-30 high priority",
        "View department analytics for this month",
        "Create a new department called 'Engineering' (Should be BLOCKED)"
    ],
    "Team Lead": [
        "View team attendance for today",
        "View team tasks",
        "Approve timesheet for Vardhan",
        "Raise correction for task ID 123",
        "View payslips",
        "Approve Akbar's leave (Should be REDIRECTED to Manager/Executive)",
        "View company payroll (Should be BLOCKED)"
    ],
    "Employee": [
        "Check in for the day",
        "Apply for leave from 2025-12-28 to 2025-12-29 for personal reasons",
        "View my tasks",
        "Submit my timesheet for last week",
        "View my payslips",
        "Approve Akbar's leave (Should be BLOCKED)"
    ]
}

print("-" * 50)
print("TALENTOPS COMPREHENSIVE ROLE VERIFICATION")
print("-" * 50)

for role, messages in tests.items():
    print(f"\n>>> TESTING ROLE: {role.upper()}")
    for msg in messages:
        print(f"\n[USER]: {msg}")
        result = test_action(role.lower().replace(" ", ""), msg)
        response = result.get('response', 'ERROR/NO RESPONSE')
        print(f"[BOT]: {response}")

print("-" * 50)
print("TESTING COMPLETE")
