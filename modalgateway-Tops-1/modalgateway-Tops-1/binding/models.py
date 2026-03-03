from pydantic import BaseModel
from typing import Optional, Dict, Any, List

class SLMQueryRequest(BaseModel):
    query: str
    user_id: str
    user_role: str = "employee"
    project_id: Optional[str] = None
    org_id: Optional[str] = None
    team_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    is_confirmed: bool = False
    pending_action: Optional[str] = None
    pending_params: Optional[Dict[str, Any]] = None
    forced_action: Optional[str] = None
    rag_content: Optional[str] = None
    rag_source: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = None
    app_name: Optional[str] = None

class SLMQueryResponse(BaseModel):
    response: str
    action: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class LLMQueryRequest(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = None
    temperature: Optional[float] = 0.3
    max_tokens: Optional[int] = 500
    persona: Optional[str] = "hr"

class LLMQueryResponse(BaseModel):
    answer: str
    model: str
    tokens_used: int
    persona: str

class OrchestratorRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    org_id: Optional[str] = None
    app_name: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

class RAGIngestRequest(BaseModel):
    doc_id: Optional[str] = None
    user_id: Optional[str] = None # Added for privacy
    org_id: Optional[str] = None
    project_id: Optional[str] = None
    text: Optional[str] = ""
    file_url: Optional[str] = None
    metadata: Dict[str, Any] = {}
    app_name: Optional[str] = "talentops"

class RAGQueryRequest(BaseModel):
    question: str
    user_id: Optional[str] = None # Added for privacy
    org_id: Optional[str] = None
    project_id: Optional[str] = None
    app_name: Optional[str] = "talentops"
