import os
import io
import json
import logging
import traceback
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import requests
import PyPDF2
# Try to import python-docx
try:
    from docx import Document as DocxDocument
except ImportError:
    DocxDocument = None

from openai import OpenAI

# -----------------------------------------------------------------------------
# 1. LOGGING & CONFIG
# -----------------------------------------------------------------------------
load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] [DocID:%(doc_id)s] %(message)s')
logger = logging.getLogger("RAG-Backend")

def log_debug(msg, doc_id="N/A", proj_id="N/A", **kwargs):
    extra = {"doc_id": doc_id, "project_id": proj_id}
    print(f"[{doc_id}] [{proj_id}] {msg} | {kwargs}")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PORT = int(os.getenv("PORT", 8040))
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("CRITICAL: SUPABASE_URL or SUPABASE_KEY is missing.")

openai_client = OpenAI(api_key=OPENAI_API_KEY)
together_client = OpenAI(api_key=TOGETHER_API_KEY, base_url="https://api.together.xyz/v1")

@app.get("/health")
def health_check():
    return {"status": "ok"}

# GLOBAL SUPABASE CLIENT (Reuse)
class SimpleSupabaseClient:
    def __init__(self, url, key):
        self.url = url
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    def insert(self, table: str, data: Any):
        url = f"{self.url}/rest/v1/{table}"
        resp = requests.post(url, headers=self.headers, json=data)
        if resp.status_code not in [200, 201]:
            raise Exception(f"Insert Failed: {resp.text}")
        return resp.json()

    def delete(self, table: str, match_col: str, match_val: str):
        url = f"{self.url}/rest/v1/{table}?{match_col}=eq.{match_val}"
        resp = requests.delete(url, headers=self.headers)
        if resp.status_code not in [200, 204]:
            raise Exception(f"Delete Failed: {resp.text}")
        return True

    def select_one(self, table: str, match_col: str, match_val: str):
        url = f"{self.url}/rest/v1/{table}?{match_col}=eq.{match_val}&limit=1"
        resp = requests.get(url, headers=self.headers)
        if resp.status_code == 200:
            data = resp.json()
            return data[0] if data else None
        return None

    def rpc(self, name: str, params: Dict):
        url = f"{self.url}/rest/v1/rpc/{name}"
        resp = requests.post(url, headers=self.headers, json=params)
        if resp.status_code == 200:
            return resp.json()
        print(f"RPC Error: {resp.text}")
        return None

supabase = SimpleSupabaseClient(SUPABASE_URL, SUPABASE_KEY)

# -----------------------------------------------------------------------------
# 2. PARSING & CHUNKING
# -----------------------------------------------------------------------------
def chunk_text(text: str, chunk_size=500, overlap=50) -> List[str]:
    words = text.split()
    if not words: return []
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
    return chunks

def get_embeddings_batch(texts: List[str]) -> List[List[float]]:
    clean_texts = [t.replace("\n", " ") for t in texts]
    if not clean_texts: return []
    try:
        resp = openai_client.embeddings.create(input=clean_texts, model="text-embedding-3-small")
        return [d.embedding for d in resp.data]
    except Exception as e:
        print(f"Embedding Error: {e}")
        raise e

def parse_file_from_url(url: str) -> str:
    """Supports PDF, DOCX, TXT"""
    if not url: return ""
    try:
        print(f"Downloading: {url}")
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        
        content_type = resp.headers.get('Content-Type', '').lower()
        url_lower = url.lower()
        file_stream = io.BytesIO(resp.content)

        if url_lower.endswith('.pdf') or 'pdf' in content_type:
            reader = PyPDF2.PdfReader(file_stream)
            return "\n".join([p.extract_text() or "" for p in reader.pages])
        
        elif url_lower.endswith('.docx') or 'wordprocessingml' in content_type:
            if DocxDocument is None:
                print("WARNING: python-docx not installed. Skipping DOCX.")
                return ""
            doc = DocxDocument(file_stream)
            return "\n".join([p.text for p in doc.paragraphs])
            
        else:
            return resp.content.decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"File Parse Error: {e}")
        return ""

class IngestRequest(BaseModel):
    doc_id: Optional[str] = None
    org_id: Optional[str] = None
    project_id: Optional[str] = None
    text: Optional[str] = ""
    file_url: Optional[str] = None
    metadata: Dict[str, Any] = {}

class QueryRequest(BaseModel):
    question: str
    org_id: str
    project_id: Optional[str] = None

@app.post("/docs/ingest")
async def ingest_document(req: IngestRequest):
    """
    FIX 1: DOCUMENT IDENTITY & FIX 3: TRANSACTION SAFETY
    """
    doc_id = req.doc_id or req.metadata.get('doc_id')
    org_id = req.org_id or req.metadata.get('org_id')
    project_id = req.project_id or req.metadata.get('project_id')
    
    # Validation
    if not org_id or not doc_id:
        return {"success": False, "message": "Missing org_id or doc_id"}

    log_debug("Ingest Start", doc_id=doc_id, proj_id=project_id)

    try:
        # A. PARSE (Fix 2 & 4)
        file_text = ""
        if req.file_url or req.metadata.get('file_url'):
            url = req.file_url or req.metadata.get('file_url')
            file_text = parse_file_from_url(url)
            
        full_text = (req.text or "") + "\n\n" + file_text
        full_text = full_text.strip()
        
        if len(full_text) < 5:
            return {"success": False, "message": "Extracted content empty"}

        # B. CHUNK & EMBED (Fix 2)
        chunks = chunk_text(full_text)
        embeddings = get_embeddings_batch(chunks)
        
        if not chunks:
             return {"success": False, "message": "No chunks created"}

        # C. ATOMIC-LIKE SWAP (Fix 1 & 3)
        # 1. Upsert Parent Doc (Ensure it exists)
        try:
            doc_data = {
                "id": doc_id,
                "org_id": org_id,
                "project_id": project_id,
                "title": req.metadata.get('title', 'Doc')
            }
            supabase.insert("documents", doc_data)
        except:
             pass 

        # 2. Delete OLD Chunks (First)
        supabase.delete("document_chunks", "document_id", doc_id)
        
        # 3. Insert NEW Chunks
        records = []
        for txt, emb in zip(chunks, embeddings):
            records.append({
                "document_id": doc_id,
                "org_id": org_id,
                "project_id": project_id,
                "content": txt,
                "embedding": emb
            })
        
        supabase.insert("document_chunks", records)
        log_debug(f"Ingest Success: {len(records)} chunks", doc_id=doc_id)
        
        return {"success": True, "chunks": len(records), "message": "Ingested"}

    except Exception as e:
        log_debug(f"Ingest Logic Failed: {e}", doc_id=doc_id)
        traceback.print_exc()
        return {"success": False, "message": str(e)}

@app.post("/query")
async def query_rag(req: QueryRequest):
    """
    FIX 4: RETRIEVAL QUERY
    """
    log_debug("Query Start", proj_id=req.project_id, q=req.question)
    try:
        q_emb = get_embeddings_batch([req.question])[0]
        
        filters = {"org_id": req.org_id}
        if req.project_id:
            filters["project_id"] = req.project_id
            

        params = {
            "query_embedding": q_emb,
            "match_threshold": 0.50, # Lowering threshold to ensure matches
            "match_count": 5,
            "filter": filters
        }
        
        # DEBUG: Log params to see what we are sending
        log_debug(f"RPC Params: Threshold=0.50, Filter={filters}", proj_id=req.project_id)
        
        matches = supabase.rpc("match_documents", params) or []
        log_debug(f"Matches: {len(matches)}", proj_id=req.project_id)
        
        if not matches:
             return {"answer": "No relevant project documents found.", "sources": []}
             
        # Fetch Titles for context
        doc_map = {}
        if matches:
            doc_ids = list(set([m['id'] for m in matches]))
            ids_str = ",".join(doc_ids)
            try:
                # PostgREST filter: id=in.(uuid1,uuid2)
                t_url = f"{supabase.url}/rest/v1/documents?id=in.({ids_str})&select=id,title"
                tr = requests.get(t_url, headers=supabase.headers)
                if tr.status_code == 200:
                    for d in tr.json():
                        doc_map[d['id']] = d['title']
            except Exception as e:
                print(f"Title fetch error: {e}")

        # Generate Answer
        context_parts = []
        for m in matches:
            title = doc_map.get(m['id'], 'Unknown Document')
            context_parts.append(f"Document Title: {title}\nContent: {m['content']}")
            
        context = "\n\n".join(context_parts)
        sys_prompt = "You are a helpful assistant. Use ONLY the provided context. If unsure, say you don't know."
        usr_prompt = f"Context:\n{context}\n\nQuestion: {req.question}"
        
        resp = together_client.chat.completions.create(
            model="meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
            messages=[{"role": "system", "content": sys_prompt}, {"role": "user", "content": usr_prompt}],
            temperature=0.0
        )
        return {"answer": resp.choices[0].message.content, "sources": [m['id'] for m in matches]}

    except Exception as e:
        log_debug(f"Query Exception: {e}")
        return {"answer": "I found some documents but encountered an error processing them.", "sources": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
