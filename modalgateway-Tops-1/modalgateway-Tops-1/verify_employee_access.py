import httpx
import asyncio
import json

async def verify_employee_policy_access():
    # Use the port where the server is running (8035 according to logs, or 8036 if using the fresh one)
    url = "http://localhost:8036/rag/query" # Port 8036 has the latest code
    
    # Mocking an Employee role with a Project ID
    # These IDs are from the previous check (Leave Policy is global/null project, but this user is in a project)
    payload = {
        "question": "What is the Leave Policy about?",
        "org_id": "dde0a075-5eb3-4b4b-8de3-0a6b1162951f",
        "user_id": "dde0a075-5eb3-4b4b-8de3-0a6b1162951f", # Generic user
        "project_id": "b1cf5d45-81d6-40b1-a7e9-c07dc5e0fb56", # A project the employee belongs to
        "user_role": "employee"
    }
    
    print(f"--- Testing Policy Retrieval for EMPLOYEE (with Project Filter) ---")
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                result = resp.json()
                print(f"Answer: {result.get('answer')[:300]}...")
                sources = result.get('sources', [])
                print(f"Sources found: {sources}")
                
                if "Leave Policy" in sources:
                    print("✅ SUCCESS: Global Policy retrieved despite Project Filter.")
                else:
                    print("❌ FAILURE: Global Policy NOT retrieved. Ensure the SQL match_documents function is updated in Supabase.")
            else:
                print(f"Error: {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(verify_employee_policy_access())
