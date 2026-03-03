"""
OpenAI LLM Backend Server
Standalone server that uses OpenAI API with guardrails for fallback assistance
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
import json
from openai import OpenAI
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(title="OpenAI LLM Backend", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY not found in environment variables")

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")  # or "gpt-4" for better quality
PORT = int(os.getenv("LLM_PORT", 8036))  # Different port from SLM backend

# Initialize OpenAI client
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Load system prompt
def load_system_prompt() -> str:
    """Load the guardrailed system prompt"""
    prompt_path = os.path.join(os.path.dirname(__file__), "system_prompt.txt")
    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception as e:
        logger.error(f"Failed to load system prompt: {e}")
        return "You are a professional workplace assistant."

SYSTEM_PROMPT = load_system_prompt()
logger.info(f"Loaded system prompt ({len(SYSTEM_PROMPT)} chars)")

# Load refusal templates
def load_refusal_templates() -> Dict[str, str]:
    """Load standardized refusal responses"""
    templates_path = os.path.join(os.path.dirname(__file__), "refusal_templates.json")
    try:
        with open(templates_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load refusal templates: {e}")
        return {}

REFUSAL_TEMPLATES = load_refusal_templates()

# Request/Response Models
class QueryRequest(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = None
    temperature: Optional[float] = 0.3
    max_tokens: Optional[int] = 500
    persona: Optional[str] = "hr"  # hr, pm, executive

class QueryResponse(BaseModel):
    answer: str
    model: str
    tokens_used: int
    persona: str

# Health Check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "OpenAI LLM Backend",
        "model": OPENAI_MODEL,
        "version": "1.0.0"
    }

# Main Query Endpoint
@app.post("/api/llm/query", response_model=QueryResponse)
async def query_llm(request: QueryRequest):
    """
    Query the OpenAI LLM with guardrails
    
    This endpoint:
    - Enforces domain restrictions (workplace-only)
    - Uses guardrailed system prompt
    - Returns professional, bounded responses
    """
    try:
        logger.info(f"Received query: {request.query[:100]}...")
        
        # Prepare messages
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": request.query}
        ]
        
        # Add persona context if specified
        if request.persona and request.persona in ["hr", "pm", "executive"]:
            persona_context = f"\n\n[Context: User is in {request.persona.upper()} role]"
            messages[1]["content"] += persona_context
        
        # Call OpenAI API
        response = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )
        
        answer = response.choices[0].message.content
        tokens_used = response.usage.total_tokens
        
        logger.info(f"Generated response ({tokens_used} tokens)")
        
        return QueryResponse(
            answer=answer,
            model=OPENAI_MODEL,
            tokens_used=tokens_used,
            persona=request.persona or "hr"
        )
    
    except Exception as e:
        logger.error(f"LLM query failed: {e}")
        raise HTTPException(status_code=500, detail=f"LLM query failed: {str(e)}")

# Test Endpoint
@app.post("/api/llm/test")
async def test_guardrails(request: QueryRequest):
    """
    Test endpoint to validate guardrails
    Returns both the answer and whether it should have been refused
    """
    try:
        # Check if query should be refused based on keywords
        forbidden_keywords = [
            "weather", "news", "stock", "sports", "recipe", "movie",
            "game", "celebrity", "politics", "religion"
        ]
        
        query_lower = request.query.lower()
        should_refuse = any(keyword in query_lower for keyword in forbidden_keywords)
        
        # Get LLM response
        response = await query_llm(request)
        
        return {
            "answer": response.answer,
            "should_refuse": should_refuse,
            "model": response.model,
            "tokens_used": response.tokens_used,
            "test_passed": should_refuse == ("cannot" in response.answer.lower() or "not able" in response.answer.lower())
        }
    
    except Exception as e:
        logger.error(f"Test failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Startup Event
@app.on_event("startup")
async def startup_event():
    """Log startup information"""
    logger.info("=" * 60)
    logger.info("OpenAI LLM Backend Server Starting...")
    logger.info(f"Model: {OPENAI_MODEL}")
    logger.info(f"Port: {PORT}")
    logger.info(f"System Prompt Loaded: {len(SYSTEM_PROMPT)} characters")
    logger.info(f"Refusal Templates: {len(REFUSAL_TEMPLATES)} loaded")
    logger.info("=" * 60)

# Main
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
