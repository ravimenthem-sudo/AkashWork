import asyncio
import os
import json
from dotenv import load_dotenv

import sys
sys.path.append(os.getcwd())

load_dotenv()

from binding import supabase, init_db

async def check_policies_table():
    url = os.getenv("TALENTOPS_SUPABASE_URL")
    key = os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")
    init_db(url, key)
    
    print("--- AUDITING 'policies' TABLE ---")
    
    try:
        # Check policies table
        resp = await supabase.table("policies").select("*").order("created_at", desc=True).limit(20).execute()
        policies = resp.data if resp.data else []
        
        if not policies:
            print("No policies found in the 'policies' table.")
            return

        print(f"{'TITLE':40} | {'CATEGORY':20} | {'CREATED AT'}")
        print("-" * 100)
        
        for p in policies:
            title = p.get('title', 'Unknown')
            category = p.get('category', 'Unknown')
            created_at = p.get('created_at', 'Unknown')
            print(f"{title:40} | {category:20} | {created_at}")

        # Also check if these exist in the 'documents' table for RAG
        print("\n--- RAG COMPLIANCE CHECK ---")
        for p in policies[:5]:
            p_id = p.get('id')
            p_title = p.get('title')
            
            # Since IDs might differ between tables, check by title or file_url
            doc_resp = await supabase.table("documents").select("id").eq("title", p_title).execute()
            is_in_rag = len(doc_resp.data) > 0 if doc_resp.data else False
            
            status = "✅ IN RAG" if is_in_rag else "❌ NOT IN RAG"
            print(f"{p_title:40} | {status}")

    except Exception as e:
        # If table doesn't exist, this will error
        print(f"Error checking 'policies' table: {e}")

if __name__ == "__main__":
    asyncio.run(check_policies_table())
