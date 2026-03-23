import asyncio
import os
import json
from dotenv import load_dotenv

import sys
sys.path.append(os.getcwd())

load_dotenv()

from binding import supabase, init_db

async def final_audit():
    url = os.getenv("TALENTOPS_SUPABASE_URL")
    key = os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")
    init_db(url, key)
    
    try:
        # Get counts
        proj_resp = await supabase.table("project_documents").select("id").execute()
        uploads_count = len(proj_resp.data) if proj_resp.data else 0
        
        doc_resp = await supabase.table("documents").select("id, title").execute()
        processed_docs = doc_resp.data if doc_resp.data else []
        
        report = []
        report.append(f"Total Uploaded Documents (project_documents): {uploads_count}")
        report.append(f"Total Processed Documents (documents): {len(processed_docs)}")
        report.append("\n--- Ingestion Pipeline Status (Knowledge Base) ---")
        
        for doc in processed_docs:
            d_id = doc['id']
            title = doc['title']
            
            c_resp = await supabase.table("document_chunks").select("id").eq("document_id", d_id).limit(1).execute()
            has_chunks = len(c_resp.data) > 0 if c_resp.data else False
            
            status = "✅ INGESTED (Chunks & Embeddings Ready)" if has_chunks else "❌ FAILED (No Chunks Found)"
            report.append(f"{title:40} | {status}")
            
        print("\n".join(report))

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(final_audit())
