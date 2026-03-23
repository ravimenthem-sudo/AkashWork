from dotenv import load_dotenv
import os
import asyncio

# Load env before imports that use them
load_dotenv()

from binding import (
    supabase, 
    chunk_text, 
    get_embeddings, 
    parse_file_from_url, 
    select_client, 
    init_db,
    init_rag
)
import logging
from openai import AsyncOpenAI

# Initialize clients
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize DB
init_db(
    os.getenv("TALENTOPS_SUPABASE_URL"),
    os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")
)
select_client("talentops")
init_rag(openai_client)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def ingest_policies():
    logger.info("🚀 Starting Policy Ingestion Sync...")
    
    # 1. Fetch all policies from the 'policies' table
    try:
        res = await supabase.table("policies").select("*").execute()
        policies = res.data
        if not policies:
            logger.info("No policies found in 'policies' table.")
            return
        
        logger.info(f"Found {len(policies)} policies to process.")
        
        for policy in policies:
            doc_id = policy['id']
            title = policy['title']
            file_url = policy.get('file_url')
            org_id = policy.get('org_id')
            
            if not file_url:
                logger.warning(f"Skipping policy '{title}' (ID: {doc_id}) - No file_url found.")
                continue
                
            logger.info(f"Processing: {title} ({doc_id})")
            
            # Use project_id = None for Global policies
            project_id = None 
            
            # A. Extract text
            try:
                full_text = await parse_file_from_url(file_url)
                if not full_text or len(full_text.strip()) < 10:
                    logger.warning(f"Skipping '{title}' - Could not extract meaningful text.")
                    continue
            except Exception as e:
                logger.error(f"Error parsing file for '{title}': {e}")
                continue
                
            # B. Insert into 'documents' (ignore if exists)
            try:
                await supabase.table("documents").insert({
                    "id": doc_id,
                    "org_id": org_id,
                    "project_id": project_id, # NULL
                    "title": title
                }).execute()
            except Exception as e:
                # If it already exists, that's fine, we continue to refresh chunks
                logger.info(f"Note: Document parent entry check for '{title}': {e}")
                
            # C. Clean old chunks
            try:
                # Use project_id query param to ensure we only delete specific one if needed, 
                # but doc_id should be enough.
                await supabase.table("document_chunks").delete().eq("document_id", doc_id).execute()
            except Exception as e:
                logger.warning(f"Note: Cleanup for '{title}' failed: {e}")
                
            # D. Chunk and Embed
            chunks = chunk_text(full_text)
            embeddings_res = await get_embeddings(chunks)
            embeddings, _ = embeddings_res if isinstance(embeddings_res, tuple) else (embeddings_res, 0)
            
            if not chunks or not embeddings:
                logger.error(f"Failed to process content for '{title}'")
                continue
                
            # E. Bulk insert chunks
            records = []
            for i, chunk in enumerate(chunks):
                records.append({
                    "document_id": doc_id,
                    "org_id": org_id,
                    "project_id": project_id, # Explicitly NULL
                    "content": chunk,
                    "embedding": embeddings[i]
                })
            
            try:
                await supabase.table("document_chunks").insert(records).execute()
                logger.info(f"✅ Successfully ingested '{title}' ({len(chunks)} chunks)")
            except Exception as e:
                logger.error(f"Error inserting chunks for '{title}': {e}")

    except Exception as e:
        logger.error(f"Sync process failed: {e}")

if __name__ == "__main__":
    asyncio.run(ingest_policies())
