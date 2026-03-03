import asyncio
from pathlib import Path
from typing import List, Dict, Any
import logging

from services.chunker import get_chunker
from services.embedding_service import get_embedding_service
from services.vector_db import get_vector_db
from models.schemas import UserRole

logger = logging.getLogger(__name__)

class DocumentIngestion:
    """Document ingestion pipeline for RAG"""
    
    def __init__(self):
        self.chunker = get_chunker()
        self.embedding_service = get_embedding_service()
        self.vector_db = get_vector_db()
    
    async def ingest_document(
        self,
        file_path: str,
        document_id: str,
        document_type: str,
        department: str = "general",
        role_visibility: List[UserRole] = None,
        version: str = "1.0"
    ):
        """
        Ingest a single document
        
        Args:
            file_path: Path to document file
            document_id: Unique document identifier
            document_type: Type (policy, sop, project_doc)
            department: Department name
            role_visibility: Roles that can access (default: all)
            version: Document version
        """
        if role_visibility is None:
            role_visibility = ["all"]
        
        logger.info(f"Ingesting document: {document_id} from {file_path}")
        
        # Read document
        text = self._read_document(file_path)
        
        # Chunk document
        metadata = {
            "document_type": document_type,
            "department": department,
            "role_visibility": [r.value if isinstance(r, UserRole) else r for r in role_visibility],
            "version": version
        }
        
        chunks = self.chunker.chunk_document(
            text=text,
            document_id=document_id,
            document_type=document_type,
            metadata=metadata
        )
        
        logger.info(f"Generated {len(chunks)} chunks")
        
        # Embed chunks
        chunk_texts = [c["content"] for c in chunks]
        embeddings = self.embedding_service.embed_documents(chunk_texts)
        
        logger.info(f"Generated {len(embeddings)} embeddings")
        
        # Prepare for vector DB
        chunk_ids = [c["chunk_id"] for c in chunks]
        chunk_metadatas = [
            {
                "document_id": c["document_id"],
                "document_type": c["document_type"],
                "section_title": c.get("section_title"),
                "department": c.get("department"),
                "role_visibility": c.get("role_visibility"),
                "version": c.get("version")
            }
            for c in chunks
        ]
        
        # Add to vector DB
        self.vector_db.add_documents(
            chunks=chunk_texts,
            embeddings=embeddings,
            metadatas=chunk_metadatas,
            ids=chunk_ids
        )
        
        logger.info(f"Successfully ingested document: {document_id}")
        
        return {
            "document_id": document_id,
            "chunks_created": len(chunks),
            "status": "success"
        }
    
    async def ingest_directory(
        self,
        directory_path: str,
        document_type: str = "general",
        department: str = "general"
    ):
        """Ingest all documents in a directory"""
        path = Path(directory_path)
        
        if not path.exists():
            raise FileNotFoundError(f"Directory not found: {directory_path}")
        
        results = []
        
        # Find all text files
        for file_path in path.glob("**/*.txt"):
            document_id = file_path.stem
            
            try:
                result = await self.ingest_document(
                    file_path=str(file_path),
                    document_id=document_id,
                    document_type=document_type,
                    department=department
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to ingest {file_path}: {e}")
                results.append({
                    "document_id": document_id,
                    "status": "failed",
                    "error": str(e)
                })
        
        return results
    
    def _read_document(self, file_path: str) -> str:
        """Read document text (supports .txt, .md for now)"""
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # For now, just read text files
        # TODO: Add PDF, DOCX support
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def delete_document(self, document_id: str):
        """Delete document and all its chunks"""
        self.vector_db.delete_document(document_id)
        logger.info(f"Deleted document: {document_id}")

# CLI script for testing
if __name__ == "__main__":
    import sys
    
    logging.basicConfig(level=logging.INFO)
    
    if len(sys.argv) < 2:
        print("Usage: python ingestion.py <file_path> [document_id]")
        sys.exit(1)
    
    file_path = sys.argv[1]
    document_id = sys.argv[2] if len(sys.argv) > 2 else Path(file_path).stem
    
    ingestion = DocumentIngestion()
    
    result = asyncio.run(ingestion.ingest_document(
        file_path=file_path,
        document_id=document_id,
        document_type="policy",
        department="hr"
    ))
    
    print(f"Ingestion result: {result}")
