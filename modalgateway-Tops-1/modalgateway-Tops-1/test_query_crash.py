import asyncio
import traceback
from binding import SLMQueryRequest

async def main():
    try:
        from unified_server import slm_chat
        req = SLMQueryRequest(
            query="tell me about the project policies",
            user_id="dde0a075-5eb3-4b4b-8de3-0ae4c9e844fa", # Dummy UUID
            org_id="dde0a075-5eb3-4b4b-8de3-0ae4c9e844fa",
            project_id="f47ac10b-58cc-4372-a567-0e02b2c3d479",
            app_name="talentops",
            forced_action="chat",
            pending_params={"llm_response": "mock fallback answer"},
            history=[]
        )
        res = await slm_chat(req, None)
        with open("error_out.txt", "w") as f:
            f.write(str(res))
    except Exception as e:
        with open("error_out.txt", "w") as f:
            traceback.print_exc(file=f)

if __name__ == "__main__":
    asyncio.run(main())
