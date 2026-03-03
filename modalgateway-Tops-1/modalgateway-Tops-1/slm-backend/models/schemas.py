from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    EXECUTIVE = "executive"
    MANAGER = "manager"
    TEAM_LEAD = "team_lead"
    EMPLOYEE = "employee"

class ButtonType(str, Enum):
    QUERY = "query"
    ACTION = "action"
    NAVIGATION = "navigation"

class PageContext(BaseModel):
    route: str = Field(..., description="Current page route")
    module: str = Field(..., description="Module name (tasks, performance, etc)")
    role: UserRole
    user_id: str
    project_id: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    selected_items: Optional[List[str]] = None

class SmartButton(BaseModel):
    id: str
    label: str
    type: ButtonType
    icon: str
    action_type: Optional[str] = None
    rag_required: bool = False
    llm_required: bool = False
    permission_level: int = Field(1, ge=1, le=4)

class TaggedDocument(BaseModel):
    document_id: str
    scope: str = Field("full_document", pattern="^(full_document|section|page_range)$")
    start_page: Optional[int] = None
    end_page: Optional[int] = None
    section_id: Optional[str] = None

class ChatQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    context: PageContext
    tagged_doc: Optional[TaggedDocument] = None
    button_id: Optional[str] = None

class RetrievedChunk(BaseModel):
    chunk_id: str
    content: str
    document_id: str
    document_type: str
    section_title: Optional[str]
    similarity_score: float
    metadata: Dict[str, Any]

class ChatResponse(BaseModel):
    answer: str
    source_chunks: List[str] = Field(default_factory=list)
    confidence: float
    out_of_scope: bool = False
    response_type: str = "text"  # text, data_filter, navigation
    data: Optional[Any] = None
    citations: Optional[List[Dict[str, str]]] = None
    
    # Validator removed to prevent crashes on error responses
    # @validator('answer') block was here

class ButtonActionRequest(BaseModel):
    button_id: str
    context: PageContext

class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    document_type: str
    department: str
    role_visibility: List[UserRole]
    version: str
    section_title: Optional[str]
    page_number: Optional[int]
    content: str
    embedding: List[float]
    created_at: datetime
    
class AuditLog(BaseModel):
    timestamp: datetime
    user_id: str
    role: UserRole
    page_context: str
    query: str
    intent: str
    retrieved_chunks: List[str]
    model_used: str
    token_count: int
    latency_ms: int
    confidence: float
    out_of_scope: bool
    embedding_model_version: str
    llm_model_version: str
