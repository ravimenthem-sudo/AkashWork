import re
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class DocumentChunker:
    """
    Semantic + hierarchical document chunker
    Strategy: 512 tokens base, 128 token overlap, preserve structure
    """
    
    def __init__(
        self,
        base_chunk_size: int = 512,
        overlap: int = 128,
        min_chunk_size: int = 100
    ):
        self.base_chunk_size = base_chunk_size
        self.overlap = overlap
        self.min_chunk_size = min_chunk_size
    
    def chunk_document(
        self,
        text: str,
        document_id: str,
        document_type: str,
        metadata: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Chunk document with metadata preservation
        
        Args:
            text: Document text
            document_id: Unique document identifier
            document_type: Type (policy, sop, project_doc, etc)
            metadata: Additional metadata
            
        Returns:
            List of chunk dicts with content and metadata
        """
        logger.info(f"Chunking document {document_id} ({len(text)} chars)")
        
        # Split by sections first (hierarchical)
        sections = self._split_by_sections(text)
        
        chunks = []
        chunk_idx = 0
        
        for section in sections:
            # Get section title
            section_title = self._extract_section_title(section)
            
            # Split section into smaller chunks
            section_chunks = self._chunk_text(section)
            
            for chunk_text in section_chunks:
                if len(chunk_text) < self.min_chunk_size:
                    continue
                
                chunk = {
                    "chunk_id": f"{document_id}_chunk_{chunk_idx}",
                    "document_id": document_id,
                    "document_type": document_type,
                    "section_title": section_title,
                    "content": chunk_text,
                    "char_count": len(chunk_text),
                    **metadata
                }
                
                chunks.append(chunk)
                chunk_idx += 1
        
        logger.info(f"Created {len(chunks)} chunks from document {document_id}")
        return chunks
    
    def _split_by_sections(self, text: str) -> List[str]:
        """Split document by sections (headers)"""
        # Look for markdown headers or numbered sections
        section_pattern = r'(?:^|\n)(#{1,3}\s+.+|(?:\d+\.)+\s+.+)'
        
        sections = re.split(section_pattern, text)
        
        # Combine header with content
        combined = []
        for i in range(0, len(sections), 2):
            if i + 1 < len(sections):
                combined.append(sections[i] + sections[i + 1])
            else:
                combined.append(sections[i])
        
        # If no sections found, return whole text
        if len(combined) <= 1:
            return [text]
        
        return [s.strip() for s in combined if s.strip()]
    
    def _extract_section_title(self, section: str) -> Optional[str]:
        """Extract section title from text"""
        # Look for markdown header
        header_match = re.match(r'^#{1,3}\s+(.+)', section)
        if header_match:
            return header_match.group(1).strip()
        
        # Look for numbered section
        numbered_match = re.match(r'^(?:\d+\.)+\s+(.+)', section)
        if numbered_match:
            return numbered_match.group(1).strip()
        
        return None
    
    def _chunk_text(self, text: str) -> List[str]:
        """
        Split text into chunks with overlap
        Using simple word-based chunking (can be upgraded to token-based)
        """
        words = text.split()
        chunks = []
        
        i = 0
        while i < len(words):
            # Take chunk_size words
            chunk_words = words[i:i + self.base_chunk_size]
            chunk_text = ' '.join(chunk_words)
            
            chunks.append(chunk_text)
            
            # Move by (chunk_size - overlap) for next chunk
            i += (self.base_chunk_size - self.overlap)
        
        return chunks

# Global instance
_chunker = None

def get_chunker() -> DocumentChunker:
    """Get or create singleton chunker"""
    global _chunker
    if _chunker is None:
        _chunker = DocumentChunker()
    return _chunker
