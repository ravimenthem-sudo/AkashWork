import asyncio
import json
import os
import sys

# Add current directory to path so binding can be imported
sys.path.append(os.getcwd())

from binding import (
    supabase,
    init_db
)
from dotenv import load_dotenv

load_dotenv()

async def main():
    # Initialize DB (using env vars)
    init_db(
        os.getenv("TALENTOPS_SUPABASE_URL"),
        os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY") or os.getenv("TALENTOPS_SUPABASE_ANON_KEY")
    )
    
    try:
        resp = await supabase.table("documents").select("*").execute()
        if resp.data:
            print(json.dumps(resp.data, indent=2))
        else:
            print("No documents found.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
