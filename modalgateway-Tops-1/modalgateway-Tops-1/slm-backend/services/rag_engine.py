from typing import List, Dict, Any, Optional
import logging
import numpy as np
import os

from services.embedding_service import get_embedding_service
from services.vector_db import get_vector_db
from services.llm_gateway import get_llm_gateway
from services.guardrails import get_guardrails
from models.schemas import UserRole, ChatResponse

logger = logging.getLogger(__name__)

class RAGEngine:
    """RAG retrieval and answer generation engine"""
    
    def __init__(self):
        self.embedding_service = get_embedding_service()
        self.vector_db = get_vector_db()
        self.llm_gateway = get_llm_gateway()
        self.guardrails = get_guardrails()
        from openai import OpenAI
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    
    def query(
        self,
        query: str,
        role: UserRole,
        page_module: str,
        tagged_doc_id: Optional[str] = None,
        top_k: int = 5
    ) -> ChatResponse:
        """
        Execute RAG query with guardrails
        
        Args:
            query: User query
            role: User role (for permission filtering)
            page_module: Current page module
            tagged_doc_id: Optional document ID for scoped search
            top_k: Number of chunks to retrieve
            
        Returns:
            ChatResponse with grounded answer or out-of-scope
        """
        logger.info(f"RAG query from {role} on {page_module}: '{query[:50]}...'")
        
        # 1. Validate scope
        scope_check = self.guardrails.validate_scope(query, page_module)
        if not scope_check["valid"]:
            logger.warning(f"Out of scope: {scope_check['reason']}")
            return self._out_of_scope_response(scope_check["reason"])
        
        # 2. Check for prompt injection
        injection_check = self.guardrails.detect_injection(query)
        if injection_check["is_injection"]:
            logger.error(f"Prompt injection detected: {injection_check['patterns_found']}")
            return self._out_of_scope_response("Invalid query detected")
        
        # 3. Retrieve relevant chunks
        retrieved = self._retrieve_chunks(query, role, tagged_doc_id, top_k)
        
        if not retrieved["chunks"]:
            logger.info("No relevant chunks found")
            return self._out_of_scope_response(
                "No relevant information found in documents"
            )
        
        # 4. Calculate confidence
        confidence = self._calculate_confidence(
            retrieved["similarities"],
            retrieved["chunks"]
        )
        
        # 5. Check if should answer
        should_answer_check = self.guardrails.should_answer(
            confidence,
            len(retrieved["chunks"]),
            len(set(c["document_id"] for c in retrieved["chunks"]))
        )
        
        if not should_answer_check["should_answer"]:
            logger.info(f"Confidence too low: {should_answer_check['reason']}")
            return self._out_of_scope_response(
                f"Insufficient confidence: {should_answer_check['reason']}"
            )
        
        # 6. Generate answer with LLM
        answer = self._generate_answer(
            query,
            retrieved["chunks"],
            openai_client=self.openai_client
        )
        
        # 7. Build response with citations
        return ChatResponse(
            answer=answer,
            source_chunks=[c["chunk_id"] for c in retrieved["chunks"]],
            confidence=confidence,
            out_of_scope=False,
            citations=self._build_citations(retrieved["chunks"])
        )
    
    def _retrieve_chunks(
        self,
        query: str,
        role: UserRole,
        tagged_doc_id: Optional[str],
        top_k: int
    ) -> Dict[str, Any]:
        """Retrieve relevant chunks from vector DB"""
        # Embed query
        query_embedding = self.embedding_service.embed_query(query)
        
        # Build metadata filter
        metadata_filter = {
            "$or": [
                {"role_visibility": {"$contains": role.value}},
                {"role_visibility": {"$contains": "all"}}
            ]
        }
        
        # Add document ID filter if tagged
        if tagged_doc_id:
            metadata_filter["document_id"] = tagged_doc_id
        
        # Query vector DB
        results = self.vector_db.query(
            query_embeddings=query_embedding,
            where=metadata_filter,
            n_results=top_k
        )
        
        # Format results
        chunks = []
        if results['documents'] and results['documents'][0]:
            for i, doc in enumerate(results['documents'][0]):
                chunks.append({
                    "chunk_id": results['ids'][0][i],
                    "content": doc,
                    "document_id": results['metadatas'][0][i].get('document_id'),
                    "document_type": results['metadatas'][0][i].get('document_type'),
                    "section_title": results['metadatas'][0][i].get('section_title'),
                    "metadata": results['metadatas'][0][i]
                })
        
        return {
            "chunks": chunks,
            "similarities": results.get('similarities', [])
        }
    
    def _calculate_confidence(
        self,
        similarities: List[float],
        chunks: List[Dict]
    ) -> float:
        """
        Calculate answer confidence
        
        Factors:
        - Average similarity score (50%)
        - Coverage (30%) - how many chunks contribute
        - Diversity (20%) - unique source documents
        """
        if not similarities or not chunks:
            return 0.0
        
        # Average similarity
        avg_similarity = np.mean(similarities)
        
        # Coverage (more chunks = better coverage)
        coverage = min(len(chunks) / 5.0, 1.0)  # Normalize to 1
        
        # Source diversity (unique documents)
        unique_docs = len(set(c["document_id"] for c in chunks))
        diversity = min(unique_docs / 3.0, 1.0)  # Normalize to 1
        
        # Weighted combination
        confidence = (
            0.5 * avg_similarity +
            0.3 * coverage +
            0.2 * diversity
        )
        
        return float(confidence)
    
    def _generate_answer(
        self,
        query: str,
        chunks: List[Dict],
        openai_client: any = None
    ) -> str:
        """Generate answer using OpenAI with RAG context"""
        # Combine chunk contents
        chunk_texts = [c["content"] for c in chunks]
        
        # Use LLM gateway's RAG method
        answer = self.llm_gateway.query_with_rag(
            query=query,
            retrieved_chunks=chunk_texts,
            openai_client=openai_client
        )
        
        return answer
    
    def _build_citations(self, chunks: List[Dict]) -> List[Dict[str, str]]:
        """Build citation metadata"""
        citations = []
        for chunk in chunks:
            citations.append({
                "chunk_id": str(chunk["chunk_id"]),
                "document_type": str(chunk.get("document_type") or "Document"),
                "section": str(chunk.get("section_title") or "N/A")
            })
        return citations
    
    def _out_of_scope_response(self, reason: str) -> ChatResponse:
        """Generate out-of-scope response"""
        return ChatResponse(
            answer=f"Out of scope: {reason}. Please ask about Talent Ops policies, projects, tasks, or HR information.",
            source_chunks=[],
            confidence=0.0,
            out_of_scope=True,
            response_type="error"
        )

# Global instance
_rag_engine = None

def get_rag_engine() -> RAGEngine:
    """Get or create singleton RAG engine"""
    global _rag_engine
    if _rag_engine is None:
        _rag_engine = RAGEngine()
    return _rag_engine
