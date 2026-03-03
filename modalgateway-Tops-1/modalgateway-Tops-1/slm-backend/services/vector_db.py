import os
import requests
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class VectorDB:
    """Supabase Vector DB (using pgvector and match_documents RPC)"""
    
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL") or "https://ppptzmmecvjuvbulvddh.supabase.co"
        self.key = os.getenv("SUPABASE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwcHR6bW1lY3ZqdXZidWx2ZGRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzY0NDU5OSwiZXhwIjoyMDc5MjIwNTk5fQ.xR215A_WvpdLKoJQt20FQYaQFSBBchTxh2Mb-fX2-s4"
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json"
        }
        # Discovered org_id from existing documents
        self.default_org_id = "66bed17d-978f-43c7-8b63-3a4c3e331efb"
        logger.info(f"Initialized Supabase VectorDB at {self.url}")

    def add_documents(
        self,
        chunks: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]],
        ids: List[str]
    ):
        """
        Store documents in Supabase document_chunks table
        """
        if not chunks:
            return

        records = []
        for i in range(len(chunks)):
            meta = metadatas[i]
            records.append({
                "document_id": meta.get("document_id"),
                "org_id": meta.get("org_id") or self.default_org_id,
                "project_id": meta.get("project_id"),
                "content": chunks[i],
                "embedding": embeddings[i]
            })

        try:
            url = f"{self.url}/rest/v1/document_chunks"
            resp = requests.post(url, headers=self.headers, json=records)
            if resp.status_code not in [200, 201]:
                logger.error(f"Failed to insert chunks: {resp.text}")
            else:
                logger.info(f"Successfully added {len(records)} chunks to Supabase")
        except Exception as e:
            logger.error(f"Error adding documents to Supabase: {e}")

    def query(
        self,
        query_embeddings: List[float],
        n_results: int = 5,
        where: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Query Supabase using match_documents RPC
        """
        filters = {}
        if where:
            if "org_id" in where:
                filters["org_id"] = where["org_id"]
            if "project_id" in where:
                filters["project_id"] = where["project_id"]
        
        # Default org_id if not present
        if "org_id" not in filters:
            filters["org_id"] = self.default_org_id

        params = {
            "query_embedding": query_embeddings,
            "match_threshold": 0.50,
            "match_count": n_results,
            "filter": filters
        }

        try:
            url = f"{self.url}/rest/v1/rpc/match_documents"
            resp = requests.post(url, headers=self.headers, json=params)
            
            if resp.status_code != 200:
                logger.error(f"RPC Error: {resp.text}")
                return {"documents": [[]], "metadatas": [[]], "ids": [[]], "similarities": []}

            matches = resp.json()
            logger.info(f"Supabase RPC returned {len(matches)} matches")
            for i, m in enumerate(matches):
                logger.info(f"Match {i}: Similarity={m['similarity']:.4f}, Content={m['content'][:50]}...")
            
            docs = []
            ids = []
            metas = []
            similarities = []
            
            for m in matches:
                docs.append(m['content'])
                ids.append(m['id'])
                metas.append({"document_id": m['id']})
                similarities.append(m['similarity'])

            return {
                "documents": [docs],
                "ids": [ids],
                "metadatas": [metas],
                "similarities": similarities
            }
            
        except Exception as e:
            logger.error(f"Error querying Supabase: {e}")
            return {"documents": [[]], "metadatas": [[]], "ids": [[]], "similarities": []}

# Singleton
_vector_db = None

def get_vector_db() -> VectorDB:
    global _vector_db
    if _vector_db is None:
        _vector_db = VectorDB()
    return _vector_db
