import io
import logging
import httpx
import asyncio
import PyPDF2
from typing import List, Optional

try:
    from docx import Document as DocxDocument
except ImportError:
    DocxDocument = None

logger = logging.getLogger(__name__)

# Global client to be initialized by the host (should be an AsyncOpenAI client)
openai_client = None

def init_rag(client):
    """Initialize RAG utilities with an AsyncOpenAI client."""
    global openai_client
    openai_client = client
    logger.info("RAG utilities initialized with AsyncOpenAI client.")

def chunk_text(text: str, chunk_size=500, overlap=50) -> List[str]:
    """Split text into overlapping chunks."""
    words = text.split()
    if not words:
        return []
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
    return chunks

async def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of texts using the initialized AsyncOpenAI client."""
    if openai_client is None:
        logger.error("RAG utilities not initialized. Call init_rag(client) first.")
        return [], 0.0
        
    clean_texts = [t.replace("\n", " ") for t in texts]
    if not clean_texts:
        return [], 0.0
    
    import time
    start_time = time.perf_counter()
    try:
        resp = await openai_client.embeddings.create(
            input=clean_texts, 
            model="text-embedding-3-small",
            timeout=10
        )
        latency = time.perf_counter() - start_time
        return [d.embedding for d in resp.data], latency
    except Exception as e:
        logger.error(f"Embedding Error: {e}")
        return [], 0.0

async def parse_file_from_url(url: str) -> str:
    """Download and parse a file (PDF, DOCX, or text) from a URL asynchronously."""
    if not url: return ""
    try:
        logger.info(f"Downloading for RAG (Async): {url}")
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            
            content_type = resp.headers.get('Content-Type', '').lower()
            url_lower = url.lower()
            file_stream = io.BytesIO(resp.content)

            if url_lower.endswith('.pdf') or 'pdf' in content_type:
                reader = PyPDF2.PdfReader(file_stream)
                text = ""
                for page in reader.pages:
                    text += (page.extract_text() or "") + "\n"
                return text
            
            elif url_lower.endswith('.docx') or 'wordprocessingml' in content_type:
                if DocxDocument is None:
                    logger.warning("python-docx not installed. Skipping DOCX.")
                    return ""
                doc = DocxDocument(file_stream)
                return "\n".join([p.text for p in doc.paragraphs])
                
            else:
                try:
                    return resp.content.decode('utf-8')
                except:
                    return resp.content.decode('latin-1', errors='ignore')
    except Exception as e:
        logger.error(f"File Parse Error: {e}")
        return ""
