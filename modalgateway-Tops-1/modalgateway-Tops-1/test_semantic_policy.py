import asyncio
import os
import json
from unified_server import slm_chat, SLMQueryRequest

async def test_policy_retrieval():
    print("Starting Semantic Policy Retrieval Test...")
    
    # Mock request context
    req = SLMQueryRequest(
        query="policies",
        user_id="e2a8c3e1-3b4e-4b4e-9b4e-4e4e4e4e4e4e", # dummy
        org_id="dde0a075-5eb3-4b4b-8de3-0a6b1162951f", # Corrected org_id
        app_name="talentops",
        context={"route": "/dashboard"}
    )
    
    print(f"Query: {req.query}")
    try:
        # Note: This might hit real APIs (Together/OpenAI/Supabase)
        # We assume environment variables are set.
        response = await slm_chat(req, None) # BackgroundTasks is None
        print("\n--- Response ---")
        print(response.response)
        print("\n--- Action ---")
        print(response.action)
        
        if "policy" in response.response.lower() or "policies" in response.response.lower():
            if "not specify" not in response.response.lower():
                print("\nSUCCESS: Policies retrieved!")
            else:
                print("\nFAILURE: Bot still says information is not specified.")
        else:
            print("\nFAILURE: No mention of policies in response.")
            
    except Exception as e:
        print(f"Error during test: {e}")

if __name__ == "__main__":
    asyncio.run(test_policy_retrieval())
