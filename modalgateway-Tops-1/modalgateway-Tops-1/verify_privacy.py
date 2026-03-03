import asyncio
import httpx
import json

# Configuration
SERVER_URL = "http://localhost:8035/slm/chat"
ORG_ID = "dde0a075-5eb3-4b4b-8de3-0a6b1162951f"

# Two different users
USER_A = "user_aaa_111"
USER_B = "user_bbb_222"

async def test_privacy(query: str, user_id: str, test_name: str):
    print(f"\n[{test_name}] - User: {user_id}")
    payload = {
        "query": query,
        "user_id": user_id,
        "org_id": ORG_ID,
        "context": {"role": "employee"}
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(SERVER_URL, json=payload, timeout=30.0)
            if resp.status_code == 200:
                print(f"✅ Success")
                # Print a snippet to verify content
                print(f"Response: {resp.json().get('response')[:50]}...")
            else:
                print(f"❌ Error {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"⚠️ Connection Error: {e}")

async def run_audit():
    print("🛡️ Starting Multi-User Privacy Audit Simulation")
    
    # 1. User A asks a personal question
    await test_privacy("show my private tasks", USER_A, "U-A: Step 1 (Save Cache)")
    
    # 2. User B asks the SAME question
    # EXPECTATION: User B should NOT get User A's cached response.
    # The server log should show "Cache Miss" or "Global Knowledge".
    await test_privacy("show my private tasks", USER_B, "U-B: Step 2 (Privacy Check)")
    
    # 3. User A asks it again (Should be a CACHE HIT)
    await test_privacy("show my private tasks", USER_A, "U-A: Step 3 (Cache Verification)")

if __name__ == "__main__":
    asyncio.run(run_audit())
