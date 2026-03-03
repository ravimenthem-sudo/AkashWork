import os
import logging
from typing import List
from openai import OpenAI

logger = logging.getLogger(__name__)

class EmbeddingService:
    """Embedding service using OpenAI (matches Supabase dimensions)"""
    
    def __init__(self, model_name: str = "text-embedding-3-small"):
        self.model_name = model_name
        # Get API key from environment
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            logger.warning("OPENAI_API_KEY not found in environment variables")

        self.client = OpenAI(api_key=self.api_key)
        logger.info(f"Initialized OpenAI embedding service with model: {model_name}")

    def embed_documents(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        if not texts:
            return []
        
        # Clean newlines as recommended by OpenAI
        clean_texts = [t.replace("\n", " ") for t in texts]
        
        try:
            resp = self.client.embeddings.create(input=clean_texts, model=self.model_name)
            return [d.embedding for d in resp.data]
        except Exception as e:
            logger.error(f"Error embedding texts: {e}")
            # Return zero vectors on failure (1536 dims for text-embedding-3-small)
            return [[0.0]*1536 for _ in texts]

    def embed_query(self, text: str) -> List[float]:
        try:
            resp = self.client.embeddings.create(input=[text.replace("\n", " ")], model=self.model_name)
            return resp.data[0].embedding
        except Exception as e:
            logger.error(f"Error embedding query: {e}")
            return [0.0]*1536

    def get_model_version(self) -> str:
        return self.model_name

# Singleton
_embedding_service = None

def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
