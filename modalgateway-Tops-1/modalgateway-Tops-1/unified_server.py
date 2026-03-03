"""
Unified Modal Gateway Server
Combines SLM, LLM (OpenAI), and RAG backends into a single FastAPI application.
All routes available at the root level - no mounting needed.
Runs on port 8035.
"""

import uvicorn
import datetime as dt
import time
import os
import sys
import json
import re
import asyncio
from contextvars import ContextVar
from dotenv import load_dotenv
from rbac_rules import check_permission, ACTION_REGISTRY, get_role_level

# Load environment variables FIRST
load_dotenv()

# Set working directory to the script's directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from typing import Optional, Dict, Any, List
import json
import re
import httpx
import redis.asyncio as redis
from pydantic import BaseModel

# Import binding library
from binding import (
    supabase, 
    select_client, 
    init_db, 
    init_rag,
    SLMQueryRequest,
    SLMQueryResponse,
    LLMQueryRequest,
    LLMQueryResponse,
    OrchestratorRequest,
    RAGIngestRequest,
    RAGQueryRequest,
    chunk_text,
    get_embeddings,
    parse_file_from_url
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import io
import PyPDF2
try:
    from docx import Document as DocxDocument
except ImportError:
    DocxDocument = None

# =============================================================================
# CONFIGURATION
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# TalentOps Keys
TALENTOPS_SUPABASE_URL = os.getenv("TALENTOPS_SUPABASE_URL")
TALENTOPS_SERVICE_ROLE_KEY = os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")

# Cohort Keys 
COHORT_SUPABASE_URL = os.getenv("COHORT_SUPABASE_URL")
COHORT_SERVICE_ROLE_KEY = os.getenv("COHORT_SUPABASE_SERVICE_ROLE_KEY")

PORT = int(os.getenv("PORT", 8035))

# Initialize external clients
from together import AsyncTogether
from openai import AsyncOpenAI

together_client = AsyncTogether(api_key=TOGETHER_API_KEY)
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# Redis Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# =============================================================================
# PRODUCTION UTILITIES (Phase 2.3)
# =============================================================================

class TokenBucketRateLimiter:
    """Distributed rate limiter using Redis Token Bucket algorithm."""
    def __init__(self, r: redis.Redis, capacity: int, refill_rate: float):
        self.r = r
        self.capacity = capacity
        self.refill_rate = refill_rate # tokens per second

    async def consume(self, key: str, tokens: int = 1) -> bool:
        """Attempt to consume tokens from the bucket."""
        try:
            now = time.time()
            bucket_key = f"rate_limit:{key}"
            
            # Use Redis Lua script for atomicity
            lua = """
            local key = KEYS[1]
            local capacity = tonumber(ARGV[1])
            local refill_rate = tonumber(ARGV[2])
            local now = tonumber(ARGV[3])
            local requested = tonumber(ARGV[4])
            
            local bucket = redis.call('hgetall', key)
            local last_tokens = capacity
            local last_refill = now
            
            if #bucket > 0 then
                for i=1, #bucket, 2 do
                    if bucket[i] == 'tokens' then last_tokens = tonumber(bucket[i+1]) end
                    if bucket[i] == 'last_refill' then last_refill = tonumber(bucket[i+1]) end
                end
            end
            
            local delta = math.max(0, now - last_refill)
            local current_tokens = math.min(capacity, last_tokens + (delta * refill_rate))
            
            if current_tokens >= requested then
                redis.call('hset', key, 'tokens', current_tokens - requested, 'last_refill', now)
                redis.call('expire', key, 60)
                return 1
            else
                return 0
            end
            """
            result = await self.r.eval(lua, 1, bucket_key, self.capacity, self.refill_rate, now, tokens)
            return bool(result)
        except Exception as e:
            # logger.error(f"Rate Limiter Error: {e}") 
            return True # Fail open if Redis is not installed

class RedisSharedState:
    """Redis-backed session and history management for multi-server reliability."""
    def __init__(self, r: redis.Redis):
        self.r = r

    async def get_history(self, session_id: str, user_id: str, org_id: str = None, limit: int = 10) -> List[Dict[str, str]]:
        try:
            # Prefix with user_id for strict isolation
            key = f"history:{user_id}:{session_id}"
            data = await self.r.lrange(key, 0, limit - 1)
            # Redis stores as strings, return in ascending order for the LLM
            history = [json.loads(d) for d in data]
            return history[::-1] 
        except Exception as e:
            return []

    async def add_history(self, session_id: str, user_id: str, role: str, content: str, org_id: str = None):
        try:
            key = f"history:{user_id}:{session_id}"
            entry = json.dumps({"role": role, "content": content})
            await self.r.lpush(key, entry)
            await self.r.ltrim(key, 0, 19) # Keep last 20 messages
            await self.r.expire(key, 3600 * 24) # 24h TTL
        except Exception:
            pass

class SupabaseSharedState:
    """Supabase-backed history management (Fallback for when Redis is unavailable)."""
    def __init__(self, client_name: str = "talentops"):
        self.client_name = client_name

    async def get_history(self, session_id: str, user_id: str, org_id: str = None, limit: int = 10) -> List[Dict[str, str]]:
        try:
            client = await select_client(self.client_name)
            query = client.table("chat_history").select("role, content")
            query = query.eq("session_id", session_id).eq("user_id", user_id)
            if org_id:
                query = query.eq("org_id", org_id)
            
            response = await query.order("created_at", desc=True).limit(limit).execute()
            # Return in chronological order
            return response.data[::-1] if response.data else []
        except Exception as e:
            logger.error(f"Supabase History Error: {e}")
            return []

    async def add_history(self, session_id: str, user_id: str, role: str, content: str, org_id: str = None):
        try:
            client = await select_client(self.client_name)
            data = {
                "session_id": session_id,
                "user_id": user_id,
                "role": role,
                "content": content,
                "org_id": org_id
            }
            await client.table("chat_history").insert(data).execute()
        except Exception as e:
            logger.error(f"Error saving history to Supabase: {e}")

async def get_shared_state():
    """Factory to return Redis or Supabase state based on availability."""
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        try:
            r = redis.from_url(redis_url, decode_responses=True)
            await r.ping()
            logger.info("Using Redis for Shared State")
            return RedisSharedState(r)
        except Exception:
            logger.warning("Redis connection failed. Falling back to Supabase for history.")
    
    logger.info("Using Supabase for Shared State (Zero-Install Mode)")
    return SupabaseSharedState()

# Registry for Shared State singleton
_shared_state_instance = None

async def get_shared_state_singleton():
    """Returns a singleton instance of the shared state manager."""
    global _shared_state_instance
    if _shared_state_instance is None:
        _shared_state_instance = await get_shared_state()
    return _shared_state_instance

# Initialize Production Utilities (Phase 2.3)
# Note: rate_limiter will "fail open" if redis_client cannot connect.
rate_limiter = TokenBucketRateLimiter(redis_client, capacity=10, refill_rate=0.5)

def log_latency(model_type, ttft, total_latency, generation_latency, tokens_generated, status="success", **kwargs):
    """Structured JSON logging for production observability (Phase 2.3)."""
    try:
        tokens_per_second = tokens_generated / generation_latency if generation_latency > 0 else 0
        log_entry = {
            "timestamp": dt.datetime.now().isoformat(),
            "model": model_type,
            "latency_total_s": round(total_latency, 3),
            "latency_ttft_s": round(ttft, 3),
            "latency_gen_s": round(generation_latency, 3),
            "tps": round(tokens_per_second, 2),
            "tokens": tokens_generated,
            "status": status
        }
        log_entry.update(kwargs)
        
        # Structured JSON Output for Cloud Logging (Datadog/CloudWatch/Kibana)
        print(json.dumps(log_entry))
        
        # Friendly Human-Readable Log (Phase 2.3)
        logger.info(f"⏱️ [{model_type}] Processing Complete: Total={log_entry['latency_total_s']}s | TTFT={log_entry['latency_ttft_s']}s | Status={status}")
        
        # Backwards compatible file logging
        with open("audit_logs.json", "a") as f:
            f.write(json.dumps(log_entry) + "\n")
            
    except Exception as e:
        logger.error(f"Structured Logging Error: {e}")

# =============================================================================
# INITIALIZE BINDING LAYER (Passive Model)
# =============================================================================
init_db(
    TALENTOPS_SUPABASE_URL, 
    TALENTOPS_SERVICE_ROLE_KEY, 
    COHORT_SUPABASE_URL, 
    COHORT_SERVICE_ROLE_KEY
)
init_rag(openai_client)

# =============================================================================
# MAIN APP
# =============================================================================
app = FastAPI(title="Modal Gateway - Unified Server", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# SEMANTIC CACHE HELPERS
# =============================================================================
# Keywords that signify dynamic/personal data which must always be live
DYNAMIC_BYPASS_KEYWORDS = [
    "task", "attendance", "leave", "notification", "clock", 
    "hiring", "candidate", "analytics", "project member", "my "
]

async def check_semantic_cache(query: str, org_id: str, user_id: str, project_id: str = None) -> Optional[str]:
    """Check semantic cache for similar queries with high confidence."""
    try:
        # --- HYBRID CACHE BYPASS (Approach 5) ---
        # 0. If the query is about critical live data (tasks, attendance, etc.), skip the cache.
        q_lower = query.lower()
        if any(k in q_lower for k in DYNAMIC_BYPASS_KEYWORDS):
            logger.info(f"⏩ CACHE BYPASS: Dynamic query detected for '{query}'")
            return None

        # 1. Generate embedding for query
        q_emb, _ = await get_embeddings([query])
        if not q_emb:
            return None
        
        # 2. Query semantic_cache table via RPC
        params = {
            "query_embedding": q_emb[0],
            "match_threshold": 0.96, # High threshold for accuracy
            "match_count": 1,
            "msg_org_id": org_id,
            "msg_user_id": user_id,  # Requirement for isolation
            "msg_project_id": project_id
        }
        
        # supabase is a proxy, we need to ensure we await the result of the rpc call
        rpc_call = supabase.rpc("match_semantic_cache", params)
        resp = await rpc_call
        
        if resp.data and len(resp.data) > 0:
            match = resp.data[0]
            logger.info(f"🚀 SEMANTIC CACHE HIT: Similarity {match['similarity']:.4f}")
            return match["response_text"]
        
        return None
    except Exception as e:
        logger.error(f"Semantic Cache Lookup Error: {e}")
        return None

async def save_semantic_cache(query: str, response: str, org_id: str, user_id: str, user_role: str, project_id: str = None):
    """Save high-quality query-response pairs to semantic cache."""
    try:
        # Don't cache error messages, navigation, or clarification requests
        if any(x in response for x in ["ERROR:", "Redirecting", "not quite sure I understood", "Could you please clarify"]):
            return

        # Intelligent Logic: Only cache by user_id if query seems personal
        personal_keywords = ["my", "me", "i ", "i'm", "own"]
        is_personal = any(k in query.lower() for k in personal_keywords)
        
        save_user_id = user_id if is_personal else None
        if not is_personal:
            logger.info("🌍 Caching as Global Knowledge (No User ID)")
        else:
            logger.info(f"🔒 Caching as Personal Knowledge for user: {user_id}")

        q_emb_res = await get_embeddings([query])
        q_emb, _ = q_emb_res if isinstance(q_emb_res, tuple) else (q_emb_res, 0)
        
        if not q_emb: return

        # Ensure we await the execute() call
        query_task = supabase.table("semantic_cache").insert({
            "query_text": query,
            "query_embedding": q_emb[0],
            "response_text": response,
            "org_id": org_id,
            "project_id": project_id,
            "user_id": save_user_id,
            "user_role": user_role
        })
        await query_task.execute()
        logger.info("💾 Saved successful response to semantic cache.")
    except Exception as e:
        logger.error(f"Semantic Cache Storage Error: {e}")

# =============================================================================
# HEALTH ENDPOINTS
# =============================================================================
@app.get("/")
async def root():
    return {"message": "Modal Gateway - Unified Server", "status": "running", "port": PORT}

@app.get("/health")
async def health():
    return {"status": "ok", "services": ["slm", "llm", "rag"]}

@app.get("/slm/health")
async def slm_health():
    return {"status": "ok", "service": "SLM Backend"}

@app.get("/llm/health")
async def llm_health():
    return {"status": "ok", "service": "LLM Backend (OpenAI)"}

@app.get("/rag/health")
async def rag_health():
    return {"status": "ok", "service": "RAG Backend"}

# Infra classes (SimpleSupabaseClient, SupabaseProxy, select_client, etc.) 
# and DTO models (SLMQueryRequest, SLMQueryResponse) have been extracted 
# to the 'binding' library.

@app.post("/slm/chat")
async def slm_chat(request: SLMQueryRequest, background_tasks: BackgroundTasks):
    """Main SLM chatbot endpoint"""
    total_start = time.perf_counter()
    rag_metrics = {"embedding_latency": 0.0, "retrieval_latency": 0.0}
    is_rag_triggered = False
    try:
        query = request.query
        user_id = request.user_id
        org_id = request.org_id
        project_id = request.project_id
        team_id = request.team_id
        user_role = request.user_role or "consultant"
        app_name = (request.app_name or "talentops").lower()

        # --- 📍 LAYER 0: CONTEXT EXTRACTION (Absolute Security) ---
        # We extract this first so that ALL logic has access to user/org IDs.
        if request.context:
             if not user_id: user_id = request.context.get("user_id")
             if not org_id: org_id = request.context.get("org_id")
             if not project_id: project_id = request.context.get("project_id")
             if not team_id: team_id = request.context.get("team_id")
             if not user_role: user_role = request.context.get("role") or "consultant"
             if not request.app_name: 
                 app_name = (request.context.get("app_name") or "talentops").lower()
                 request.app_name = app_name
             else:
                 app_name = request.app_name.lower()
        else:
            app_name = (request.app_name or "talentops").lower()

        # --- DB CONTEXT SWITCHING (FIX 3: centralized via select_client) ---
        _client_error = select_client(app_name)
        if _client_error == "COHORT_UNAVAILABLE":
            return SLMQueryResponse(
                response="The Cohort service is not currently available. Please contact your administrator.",
                action="error",
                data={}
            )

        # --- 🚀 LAYER 0.2: RATE LIMITING (Phase 2.3) ---
        if not await rate_limiter.consume(f"user:{user_id}"):
            return SLMQueryResponse(
                response="System is currently under high load. Please wait a moment before your next request.",
                action="rate_limit",
                data={"retry_after": 2}
            )

        # --- 🚀 LAYER 0.5: SEMANTIC CACHE CHECK ---
        # Note: Moved to orchestrate_query for speed.

        # --- RAG DETECTION (@mention or Keywords) ---
        is_rag_query = "@" in query or any(k in query.lower() for k in RAG_KEYWORDS)
        
        # Bypass RAG if it's a simple list/show documents request (SLM is better for listing)
        if any(x in query.lower() for x in ["list documents", "show documents", "get documents", "list project documents", "show project documents", "available documents", "what documents"]):
            is_rag_query = False
            
        if is_rag_query and not request.forced_action:
            logger.info("🔒 RAG DETECTED: Fetching document content...")
            rag_req = RAGQueryRequest(
                question=query,
                org_id=org_id or request.org_id,
                project_id=project_id or request.project_id,
                app_name=app_name
            )
            rag_resp = await rag_query(rag_req)
            is_rag_triggered = True
            rag_metrics = rag_resp.get("metrics", rag_metrics)
            if rag_resp.get("answer"):
                request.forced_action = "present_rag"
                request.rag_content = rag_resp.get("answer")
                request.rag_source = ", ".join(rag_resp.get("sources", [])) if rag_resp.get("sources") else "Database"
                # Clean @mentions from query for the final synthesis
                query = re.sub(r'@[a-zA-Z0-9_]+', '', query).strip()
                request.query = query

        # --- LLM-DRIVEN INTENT CLASSIFICATION ---
        # Everything now goes through the LLM for maximum accuracy and rule compliance.
        action = request.forced_action
        params = request.pending_params or {}
        confidence = 100
        direct_response = None
        is_ambiguous = False

        # Determine dashboard prefix and navigation rules based on role and app
        norm_role = user_role.lower().replace(" ", "_")
        prefix = "/employee-dashboard/"
        if app_name == "cohort":
            prefix = "/student-dashboard/"
        if norm_role == "executive":
            prefix = "/executive-dashboard/"
        elif norm_role == "manager":
            prefix = "/manager-dashboard/"
        elif norm_role == "team_lead" or norm_role == "teamlead":
            prefix = "/teamlead-dashboard/"

        # Define navigation rules for the LLM and the redirect resolver
        if norm_role == "employee":
            nav_rules = {
                "dashboard": f"{prefix}dashboard",
                "tasks_page": f"{prefix}my-tasks",
                "attendance_page": f"{prefix}team-status",
                "leaves_page": f"{prefix}leaves",
                "team_members_page": f"{prefix}employees",
                "analytics_page": f"{prefix}analytics",
                "notifications_page": f"{prefix}notifications",
                "documents_page": f"{prefix}documents"
            }
        else:
            # Manager, Team Lead, Executive share a more similar structure but with role targets
            nav_rules = {
                "dashboard": f"{prefix}dashboard",
                "tasks_page": f"{prefix}tasks",
                "attendance_page": f"{prefix}attendance-logs" if norm_role in ["manager", "executive"] else f"{prefix}team-status",
                "leaves_page": f"{prefix}leaves",
                "team_members_page": f"{prefix}employees",
                "analytics_page": f"{prefix}analytics",
                "notifications_page": f"{prefix}notifications",
                "documents_page": f"{prefix}documents"
            }
            # Special cases for Manager
            if norm_role == "manager":
                nav_rules["my_leaves"] = f"{prefix}my-leaves"
                nav_rules["hiring_portal"] = f"{prefix}hiring"

        if not action:

            # Dynamically build ACTION SCHEMAS from the ACTION_REGISTRY
            action_schemas = []
            for act_name, act_info in ACTION_REGISTRY.items():
                schema = f'- "{act_name}": {json.dumps(act_info["parameters"])}'
                if act_name == "navigate_to_module":
                    schema = f'- "navigate_to_module": {{"module": "name", "route": "url"}} (Routes: {json.dumps(nav_rules)})'
                action_schemas.append(schema)
            
            action_schemas_str = "\n        ".join(action_schemas)

            system_prompt = f"""You are a professional workplace assistant for {app_name.title()}. 
        Your primary goal is to parse user intents into actions.
        
        CURRENT CONTEXT:
        - User Role: {user_role}
        - Current UI Page: {request.context.get("route", "Unknown") if request.context else "Unknown"}
        
        INSTRUCTIONS:
        1. **REASONING FIRST:** Determine if the user wants to SEE info (fetch) or GO to a page (navigate).
        2. **MUTATIONS ALWAYS WIN:** Instructions for data changes (approve, clock, apply) MUST use the specific functional action.
        3. **DATA RETRIEVAL (DEFAULT):** For queries starting with "show me", "what are", "list", or "get", ALWAYS use a data-fetching action (e.g., `get_notifications`, `get_tasks`, `get_project_documents`).
        4. **NAVIGATION (STRICT):** ONLY use `navigate_to_module` if the user says "go to [X] page", "open [X] module", or "take me to [X]". If they just say "show my notifications", they want to see them HERE in the chat.
        5. **MANDATORY:** Never use `navigate_to_module` for 'notifications' or 'documents' unless the word 'page' or 'module' is explicitly used.
        
        ACTION SCHEMAS:
        {action_schemas_str}

        Return ONLY JSON:
        {{
            "reasoning": "Briefly state if this is an ACTION or NAVIGATION.",
            "action": "action_name",
            "confidence": 0-100,
            "parameters": {{ "key": "value" }},
            "response": "natural language response",
            "is_ambiguous": true/false
        }}
        """
        
            try:
                # Simplify intent parsing for 8B model to prioritize Rule 8/11 compliance
                # and avoid history induced confusion in JSON output.
                # OpenAI Router in orchestrate_query already handles conversation context.
                intent_messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query}
                ]

                response = await together_client.chat.completions.create(
                    model="meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
                    messages=intent_messages,
                    temperature=0.0,
                    max_tokens=256,
                    timeout=10
                )
                
                # Check if we got a coroutine back (SDK safety)
                if asyncio.iscoroutine(response):
                    response = await response

                ai_response = response.choices[0].message.content
                
                # Try to parse JSON from response
                json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
                if json_match:
                    intent_json = json.loads(json_match.group())
                    action = intent_json.get("action", "chat")
                    params = intent_json.get("parameters", {})
                    # Normalization: Lowercase all parameter keys
                    params = {k.lower(): v for k, v in params.items()}
                    confidence = intent_json.get("confidence", 100)
                    direct_response = intent_json.get("response")
                    is_ambiguous = intent_json.get("is_ambiguous", False)
                    reasoning = intent_json.get("reasoning", "")
                    
                    logger.info(f"AI Reasoning: {reasoning}")
                    logger.info(f"Parsed Action: {action} (Ambiguous: {is_ambiguous}) with Params: {params}")
                else:
                    action = "chat"
                    params = {}
                    confidence = 0 # No JSON found, low confidence
                    is_ambiguous = False
            except Exception as e:
                logger.error(f"Error parsing AI response JSON: {e}")
                action = "chat"
                params = {}
                confidence = 0
                is_ambiguous = False
            except Exception as e:
                logger.error(f"Error parsing AI response JSON: {e}")
                action = "chat"
                params = {}
                confidence = 0
                is_ambiguous = False

        # --- AMBIGUITY & CONFIDENCE (Rule 8) ---
        # "Analyze my status" or vague terms trigger this.
        if (is_ambiguous or confidence < 75) and action != "greeting":
            logger.info(f"🛡️ AMBIGUITY DETECTED: Confidence {confidence}%")
            if "status" in query.lower():
                 return SLMQueryResponse(
                    response="I can certainly analyze your status for you. To be helpful, would you like me to check your **Tasks**, your **Attendance**, or your **Leave Balance**?",
                    action="chat",
                    data={"clarification_for": "status"}
                )
            
            # --- RULE 8 & 11 STRICT ENFORCEMENT ---
            return SLMQueryResponse(
                response="I'm not quite sure I understood that correctly. Could you please clarify what you'd like me to do? (e.g. check tasks, mark attendance, or list documents)",
                action="ask_clarification",
                data={}
            )

        # 5. Handle LLM-driven Navigation (Rule 4 & General Redirection)
        if action == "navigate_to_module":
            logger.info(f"📍 LLM-DRIVEN NAVIGATION: {params}")
            
            # Auto-resolve route if only module is provided (robustness fix)
            module = params.get("module", "")
            route = params.get("route", "")
            if module and not route:
                route = nav_rules.get(module, "")
                logger.info(f"🔄 Auto-resolved route for {module}: {route}")
            elif route and not module:
                # Reverse lookup if needed
                for mod, url in nav_rules.items():
                    if url == route:
                        module = mod
                        break
            
            msg = direct_response or "Redirecting you now..."
            if params.get("already_here"):
                msg = f"You're already on that page! The information you're looking for should be visible right here."
            
            # --- STRICT RULE 4 ENFORCEMENT ---
            current_route = request.context.get("route", "") if request.context else ""
            if (route and current_route and route.strip('/') == current_route.strip('/')) or params.get("already_here"):
                logger.info(f"🛡️ RULE 4 INTERCEPT: User is already on {current_route}. Blocking navigation.")
                return SLMQueryResponse(
                    response="The information you are looking for is already visible on your current page.",
                    action="chat",
                    data={"rule_4_intercept": True}
                )
            
            return SLMQueryResponse(
                response=msg,
                action="navigate_to_module",
                data={
                    "route": route,
                    "module": module,
                    "already_here": params.get("already_here", False)
                }
            )

        # --- AMBIGUITY & CONFIDENCE (Rule 8) ---

        # --- 0. AMBIGUITY \u0026 COMPLETENESS CHECK (Rules 8 \u0026 12) ---
        # If the query is analytical but missing dimensions, ask for them now.
        analytical_intents = ["get_tasks", "get_attendance", "get_leave_balance", "get_hiring_overview"]
        if action in analytical_intents:
            # Check for missing time ranges if it's a trend question
            trend_keywords = ["trend", "history", "analytics", "over time", "performance", "pattern"]
            is_trend_query = any(k in query.lower() for k in trend_keywords)
            
            # If it's a trend query but no time-related parameters are in the query
            time_indicators = ["month", "week", "year", "since", "from", "today", "yesterday", "january", "february", "march", "last"]
            has_time = any(t in query.lower() for (t) in time_indicators)
            
            if is_trend_query and not has_time:
                return SLMQueryResponse(
                    response="I can certainly analyze that for you. To give you an accurate trend or insight, could you please specify the **time period** (e.g., 'this month', 'last 30 days', or 'since January')?",
                    action="chat",
                    data={"context_needed": "time_range"}
                )

        data_context = ""
        # Metadata tracker for Rule 12 compliance
        data_integrity = {"status": "success", "completeness": "full", "count": 0}
        
        # --- REAL DATABASE ACTIONS (MUTATIONS) ---
        mutations = ["clock_in", "clock_out", "apply_leave", "approve_leave", "reject_leave", "post_announcement", "assign_task", "update_task_status", "create_event", "update_event", "delete_event"]
        
        if action in mutations:
            # --- DIRECT EXECUTION (Updated per User Request) ---
            try:
                current_now = dt.datetime.now()
                today = current_now.strftime("%Y-%m-%d")
                now_time = current_now.strftime("%H:%M:%S")
                
                if action == "clock_in":
                    # Check if already clocked in today
                    check = await supabase.table("attendance").select("id").eq("employee_id", user_id).eq("date", today).execute()
                    if not check.data:
                        res = await supabase.table("attendance").insert({
                            "employee_id": user_id,
                            "date": today,
                            "clock_in": now_time,
                            "org_id": request.org_id
                        }).execute()
                        data_context = f"SUCCESS: Clocked in at {now_time} on {today}."
                    else:
                        data_context = f"ERROR: You are already clocked in for today ({today})."

                elif action == "clock_out":
                    res = await supabase.table("attendance").update({"clock_out": now_time}).eq("employee_id", user_id).eq("date", today).execute()
                    if res.data:
                        data_context = f"SUCCESS: Clocked out at {now_time}."
                    else:
                        data_context = "ERROR: No clock-in record found for today. Please clock in first."

                elif action == "apply_leave":
                    leave_data = {
                        "employee_id": user_id,
                        "from_date": params.get("from_date") or params.get("start_date") or today,
                        "to_date": params.get("to_date") or params.get("end_date") or today,
                        "reason": f"{params.get('type', 'Casual')}: {params.get('reason', 'Applied via Chat')}",
                        "status": "pending",
                        "org_id": request.org_id,
                        "team_id": request.team_id
                    }
                    res = await supabase.table("leaves").insert(leave_data).execute()
                    if res.data:
                        data_context = f"SUCCESS: Leave request submitted from {leave_data['from_date']} to {leave_data['to_date']}."
                    else:
                        data_context = "ERROR: Failed to submit leave request."

                elif action in ["approve_leave", "reject_leave"]:
                    # FIX 4: RBAC via check_permission() — single source of truth
                    # Was: request.user_role.lower() in ["manager", "executive", "admin"]
                    # check_permission covers manager + executive ("admin" is not in ROLE_HIERARCHY;
                    # if admin is needed in future, add it to RBAC_RULES instead of inline lists)
                    is_authorized = check_permission(request.user_role, action)
                    
                    if not is_authorized:
                        data_context = "ERROR: You don't have permission to approve or reject leave requests. Only managers and executives can perform this action."
                    else:
                        # Get employee name from parameters
                        employee_name = params.get("employee_name")
                        rejection_reason = params.get("reason", "")
                        
                        if not employee_name:
                            data_context = "ERROR: Please specify whose leave request you want to approve/reject. Example: 'approve leave for John' or 'reject leave for Sarah'."
                        else:
                            # Find the employee by name
                            emp_res = await supabase.table("profiles").select("id, full_name").ilike("full_name", f"%{employee_name}%").eq("org_id", request.org_id).execute()
                            
                            if not emp_res.data:
                                data_context = f"ERROR: Could not find an employee named '{employee_name}' in your organization."
                            else:
                                employee_id = emp_res.data[0]["id"]
                                employee_full_name = emp_res.data[0]["full_name"]
                                
                                # Find the most recent pending leave request for this employee
                                leave_res = await supabase.table("leaves").select("id, from_date, to_date, reason").eq("employee_id", employee_id).eq("status", "pending").order("created_at", desc=True).limit(1).execute()
                                
                                if not leave_res.data:
                                    data_context = f"ERROR: No pending leave requests found for {employee_full_name}."
                                else:
                                    leave_id = leave_res.data[0]["id"]
                                    leave_dates = f"{leave_res.data[0]['from_date']} to {leave_res.data[0]['to_date']}"
                                    
                                    # Update the leave status
                                    new_status = "approved" if action == "approve_leave" else "rejected"
                                    update_data = {"status": new_status}
                                    
                                    # Add rejection reason if rejecting
                                    if action == "reject_leave" and rejection_reason:
                                        update_data["rejection_reason"] = rejection_reason
                                    
                                    res = await supabase.table("leaves").update(update_data).eq("id", leave_id).execute()
                                    
                                    if res.data:
                                        if action == "approve_leave":
                                            data_context = f"SUCCESS: Leave request for {employee_full_name} ({leave_dates}) has been approved."
                                        else:
                                            reason_text = f" Reason: {rejection_reason}" if rejection_reason else ""
                                            data_context = f"SUCCESS: Leave request for {employee_full_name} ({leave_dates}) has been rejected.{reason_text}"
                                    else:
                                        data_context = f"ERROR: Failed to update leave status for {employee_full_name}."

                elif action in ["post_announcement", "create_event"]:
                    # FIX 4: RBAC via check_permission() — single source of truth
                    # Was: request.user_role.lower() in ["executive", "manager", "admin"]
                    is_privileged = check_permission(request.user_role, action)
                    
                    target_audience = "all"
                    target_employees = []
                    
                    if not is_privileged:
                        target_audience = "employee"
                        # Fetch teammates from the current project
                        if request.project_id:
                            logger.info(f"📍 VISIBILITY: Scoping to project {request.project_id} members")
                            m_res = await supabase.table("project_members").select("user_id").eq("project_id", request.project_id).execute()
                            target_employees = [m["user_id"] for m in m_res.data] if m_res.data else []
                        
                        if not target_employees:
                            target_employees = [user_id] # Default to self if no project found

                    ann_data = {
                        "title": params.get("title") or params.get("headline") or ("New Event" if action == "create_event" else "Announcement"),
                        "message": params.get("content") or params.get("message") or params.get("description") or "",
                        "event_for": target_audience,
                        "employees": target_employees,
                        "org_id": request.org_id,
                        "created_at": dt.datetime.now().isoformat(),
                        "event_date": params.get("event_date") or params.get("start_date") or today,
                        "event_time": params.get("event_time") or params.get("start_time", "").split("T")[-1] if "T" in params.get("start_time", "") else now_time,
                        "location": params.get("location") or "Broadcast"
                    }
                    
                    # Clean up: remove time if it's a full ISO string
                    if ann_data["event_date"] and "T" in ann_data["event_date"]:
                        ann_data["event_date"] = ann_data["event_date"].split("T")[0]
                    
                    res = await supabase.table("announcements").insert(ann_data).execute()
                    if res.data:
                        label = "Event" if action == "create_event" else "Announcement"
                        data_context = f"SUCCESS: {label} '{ann_data['title']}' has been posted to {'everyone' if target_audience == 'all' else 'your team'}."
                    else:
                        data_context = f"ERROR: Failed to post {action}."
                
                elif action == "assign_task":
                    a_name = params.get("assignee_name") or params.get("user_name")
                    target_user_id = params.get("user_id") or params.get("assignee_id")
                    
                    # USER LOOKUP: If we have a name but no ID, search profiles
                    if a_name and not target_user_id:
                        logger.info(f"Looking up user ID for name: {a_name}")
                        u_res = await supabase.table("profiles").select("id, full_name").ilike("full_name", f"%{a_name}%").eq("org_id", request.org_id).execute()
                        if u_res.data:
                            target_user_id = u_res.data[0]["id"]
                            a_name = u_res.data[0]["full_name"]
                            logger.info(f"Found user: {a_name} ({target_user_id})")
                    
                    # Fallback to self ONLY if no target was mentioned at all
                    if not target_user_id and not a_name:
                        target_user_id = user_id
                        a_name = "Self"

                    if target_user_id:
                        task_data = {
                            "title": params.get("title") or "New Task",
                            "description": params.get("description") or f"Assigned via Chat",
                            "assigned_to": target_user_id,
                            "assigned_to_name": a_name or "Team Member",
                            "assigned_by": user_id,
                            "assigned_by_name": request.context.get("name") if request.context else "Manager",
                            "status": "pending",
                            "priority": params.get("priority", "medium"),
                            "due_date": params.get("due_date"),
                            "org_id": org_id or request.org_id,
                            "project_id": project_id or request.project_id,
                            "allocated_hours": 8,
                            "lifecycle_state": "requirement_refiner",
                            "sub_state": "in_progress"
                        }
                        try:
                            res = await supabase.table("tasks").insert(task_data).execute()
                            if res.data:
                                data_context = f"SUCCESS: Task '{task_data['title']}' has been assigned to {a_name}."
                            else:
                                err_info = getattr(res, 'error', 'Unknown database error')
                                data_context = f"ERROR: Database rejected the request. Details: {err_info}.\n\nHELP: To ensure success, please include the task title and assignee name clearly. Example: 'Assign task [Title] to [Name] with priority [High/Medium] and deadline [Date/Next Monday]'."
                        except Exception as e:
                            logger.error(f"Supabase Insert Error: {e}")
                            data_context = f"ERROR: Database rejected the task assignment. Technical Reason: {str(e)}"
                    else:
                        data_context = f"ERROR: I couldn't find a user named '{a_name}' to assign the task to in this organization.\n\nHELP: Try using the teammate's full name as it appears in the system."

                elif action == "update_task_status":
                    t_title = params.get("title") or params.get("task_name")
                    new_status = params.get("status") or "completed"
                    if t_title:
                        # Find task by title
                        find_res = await supabase.table("tasks").select("id").ilike("title", f"%{t_title}%").eq("org_id", request.org_id).execute()
                        if find_res.data:
                            task_id = find_res.data[0]["id"]
                            res = await supabase.table("tasks").update({"status": new_status}).eq("id", task_id).execute()
                            data_context = f"SUCCESS: Status of task '{t_title}' updated to {new_status}."
                        else:
                            data_context = f"ERROR: Could not find any task matching '{t_title}'."
                    else:
                        data_context = "ERROR: No task title provided for status update."

                elif action == "update_event":
                    event_id = params.get("event_id")
                    event_title = params.get("title")
                    update_data = {k: v for k, v in params.items() if k in ["title", "description", "start_time", "end_time", "location", "status"]}
                    
                    if event_id:
                        res = await supabase.table("events").update(update_data).eq("id", event_id).execute()
                    elif event_title:
                        find_res = await supabase.table("events").select("id").ilike("title", f"%{event_title}%").eq("org_id", request.org_id).execute()
                        if find_res.data:
                            event_id = find_res.data[0]["id"]
                            res = await supabase.table("events").update(update_data).eq("id", event_id).execute()
                        else:
                            data_context = f"ERROR: Could not find any event matching '{event_title}' to update."
                            res = None
                    else:
                        data_context = "ERROR: No event ID or title provided for update."
                        res = None

                    if res and res.data:
                        data_context = f"SUCCESS: Event '{event_title or event_id}' updated."
                    elif res: # res exists but data is empty, implies no match or other issue
                        data_context = f"ERROR: Failed to update event '{event_title or event_id}'. It might not exist or you lack permissions."

                elif action == "delete_event":
                    event_id = params.get("event_id")
                    event_title = params.get("title")
                    
                    if event_id:
                        res = await supabase.table("events").delete().eq("id", event_id).execute()
                    elif event_title:
                        find_res = await supabase.table("events").select("id").ilike("title", f"%{event_title}%").eq("org_id", request.org_id).execute()
                        if find_res.data:
                            event_id = find_res.data[0]["id"]
                            res = await supabase.table("events").delete().eq("id", event_id).execute()
                        else:
                            data_context = f"ERROR: Could not find any event matching '{event_title}' to delete."
                            res = None
                    else:
                        data_context = "ERROR: No event ID or title provided for deletion."
                        res = None

                    if res and res.data:
                        data_context = f"SUCCESS: Event '{event_title or event_id}' deleted."
                    elif res:
                        data_context = f"ERROR: Failed to delete event '{event_title or event_id}'. It might not exist or you lack permissions."
                
            except Exception as e:
                logger.error(f"Error performing {action}: {e}")
                data_context = f"ERROR: Failed to perform {action} due to a system error."

        # --- DATA FETCHING (Enhanced for ALL Roles) ---
        elif action == "get_tasks":
            try:
                # Use wildcard to be resilient to different schemas (TalentOps vs Cohort)
                # Still join projects for project names
                t_query = supabase.table("tasks").select("*, projects(name)")
                
                # Identify if the user is asking about themselves vs the team
                team_triggers = ["team", "everyone", "all employees", "all workers", "project tasks", "member tasks", "tasks of", "task of", "assigned to", "who is working on"]
                is_personal_query = any(w in query.lower() for w in ["my", " me", " i "])
                is_team_intent = any(w in query.lower() for w in team_triggers)
                
                # Role-based restriction: Managers, Team Leads, and Executives can see team data
                privileged_roles = ["executive", "manager", "team_lead", "admin"]
                is_privileged = request.user_role.lower() in privileged_roles
                
                # RULE 2 ENHANCEMENT: Explicit denial for employees requesting team data
                if is_team_intent and not is_privileged:
                    logger.info(f"🚫 RBAC BLOCK: Employee {user_id} attempted to access team tasks")
                    data_context = "As an Employee, you can only view your own tasks. Team tasks are accessible to Team Leads, Managers, and Executives. If you need information about team progress, please contact your Team Lead or Manager."
                elif is_personal_query or not is_privileged:
                    # STRICT FILTER: Show only the current user's tasks
                    logger.info(f"📍 FILTERING: Showing personal tasks for user_id: {user_id}")
                    t_query = t_query.eq("assigned_to", user_id)
                elif is_team_intent and is_privileged:
                    # ALLOW TEAM VIEW: Only for managers/executives
                    logger.info(f"📍 FILTERING: Showing team/project tasks for project_id: {request.project_id}")
                    if request.project_id:
                        t_query = t_query.eq("project_id", request.project_id)

                # Skip query execution if RBAC already set data_context (permission denial)
                if data_context:
                    pass  # Already handled by RBAC block above
                else:
                    # Filter completed unless asked
                    if "completed" not in query.lower() and "history" not in query.lower():
                        # t_query = t_query.neq("status", "Completed") 
                        # Do python filtering instead for safety
                        pass
                        
                    res = await t_query.limit(100).execute()
                    tasks = res.data if res.data is not None else []
                    data_integrity["count"] = len(tasks)
                    if res.error: data_integrity["error"] = res.error
                
                    # Python-side filtering for robustness
                    filtered_tasks = []
                    target_name_lower = None
                    
                    for t in tasks:
                        s = str(t.get('status', '')).lower()
                        
                        # 1. Filter Completed
                        # SHOW ALL if query contains: "completed", "history", "total", "all", "count"
                        show_all = any(w in query.lower() for w in ["completed", "history", "total", "all", "count"])
                        
                        if not show_all:
                            if s == 'completed':
                                continue
                                
                        filtered_tasks.append(t)
                    
                    data_integrity["count"] = len(filtered_tasks)
                    if len(filtered_tasks) < len(tasks):
                        data_integrity["completeness"] = "partial_filtered"
                        data_integrity["filter_note"] = "Completed tasks are hidden. Ask 'show all tasks' to see them."

                    if not data_context:  # Only process if not already set by RBAC
                        if filtered_tasks:
                            # RULE 5 & 9: Provide insights instead of raw lists
                            # Analyze task data for meaningful summary
                            pending_count = sum(1 for t in filtered_tasks if t.get('status', '').lower() == 'pending')
                            in_progress_count = sum(1 for t in filtered_tasks if t.get('status', '').lower() == 'in progress')
                            overdue_count = 0
                            
                            # Check for overdue tasks
                            from datetime import datetime
                            today = datetime.now().date()
                            for t in filtered_tasks:
                                due_date_str = t.get('due_date')
                                if due_date_str and t.get('status', '').lower() not in ['completed', 'done']:
                                    try:
                                        due_date = datetime.fromisoformat(str(due_date_str).split('T')[0]).date()
                                        if due_date < today:
                                            overdue_count += 1
                                    except:
                                        pass
                            
                            # RULE 12: Improved data quality messaging
                            missing_data_note = ""
                            if any(not t.get('assigned_to_name') and not t.get('assigned_to') for t in filtered_tasks):
                                missing_data_note = "\n\n⚠️ Note: Some tasks are missing assignee information in the database."
                            
                            # GAP FIX: Summarize if list is too long (> 8 items)
                            if len(filtered_tasks) > 8:
                                task_counts = {"total": len(filtered_tasks), "high": 0, "medium": 0, "low": 0}
                                for t in filtered_tasks:
                                    p = t.get('priority', 'medium').lower()
                                    if p in task_counts: task_counts[p] += 1
                                
                                data_context = f"You have {len(filtered_tasks)} tasks ({pending_count} pending, {in_progress_count} in progress"
                                if overdue_count > 0:
                                    data_context += f", {overdue_count} overdue"
                                data_context += f"). Priority breakdown: {task_counts['high']} high, {task_counts['medium']} medium, {task_counts['low']} low. Please refine your query (e.g., 'show high priority tasks' or 'show overdue tasks') to see details.{missing_data_note}"
                            else:
                                # Provide insight-driven summary with selective details
                                task_list = []
                                for t in filtered_tasks:
                                     # Safe extraction of nested project name
                                     proj_data = t.get('projects')
                                     proj_name = proj_data.get('name') if proj_data else "General"
                                     task_list.append(f"- {t.get('title')} (Project: {proj_name}, Status: {t.get('status')}, Due: {t.get('due_date')}, Assigned: {t.get('assigned_to_name') or 'Unassigned'})") 
                                
                                summary = f"You have {len(filtered_tasks)} task{'s' if len(filtered_tasks) > 1 else ''}."
                                if overdue_count > 0:
                                    summary += f" ⚠️ {overdue_count} {'is' if overdue_count == 1 else 'are'} overdue."
                                if pending_count > 0:
                                    summary += f" {pending_count} pending."
                                
                                data_context = f"{summary}\n\n" + "\n".join(task_list) + missing_data_note
                        else:
                            data_context = "No tasks found matching the criteria."
            except Exception as e:
                data_context = f"Error fetching tasks: {e}"

        # 2. TEAMS / MEMBERS (Enhanced)
        elif action == "get_team_members":
            try:
                members = []
                source_desc = ""
                
                if request.project_id:
                    # Join project_members with profiles to get names
                    logger.info(f"📍 Fetching team members for project: {request.project_id}")
                    tm_query = supabase.table("project_members").select("user_id, profiles(full_name, role, email)").eq("project_id", request.project_id)
                    members = (await tm_query.execute()).data
                    source_desc = "project"
                elif request.org_id:
                    # Fallback: Show all org members
                    logger.info(f"📍 No project context, fetching org members for: {request.org_id}")
                    org_query = supabase.table("profiles").select("id, full_name, role, email").eq("org_id", request.org_id)
                    org_profiles = (await org_query.execute()).data
                    # Transform to match expected structure
                    members = [{"profiles": p} for p in org_profiles] if org_profiles else []
                    source_desc = "organization"
                
                if members:
                    m_list = []
                    for m in members:
                        profile = m.get("profiles")
                        if profile:
                            name = profile.get("full_name") or "Unknown"
                            role = profile.get("role") or "Member"
                            m_list.append(f"- {name} ({role})")
                    
                    data_context = f"Here are the team members ({source_desc}):\n" + "\n".join(m_list)
                else:
                    if request.project_id:
                        data_context = f"No team members found for this project. The project might not have any assigned members yet."
                    elif request.org_id:
                        data_context = f"No members found in this organization."
                    else:
                        data_context = "I couldn't identify your project or organization context to fetch team members. Please ensure you're logged in and have a project assigned."
            except Exception as e:
                logger.error(f"Error fetching team members: {e}")
                data_context = f"Error fetching team members: {e}"

        # 3. ATTENDANCE
        elif action == "get_attendance":
            try:
                from datetime import datetime
                today = datetime.now().strftime("%Y-%m-%d")
                a_query = supabase.table("attendance").select("*")
                
                # Check if user is asking specifically about today
                is_today_query = any(w in query.lower() for w in ["today", "this day", "current"])
                
                # Role-based restriction: Managers, Team Leads, and Executives can see team data
                privileged_roles = ["executive", "manager", "team_lead", "admin"]
                is_privileged = request.user_role.lower() in privileged_roles
                
                is_team_query = "team" in query.lower() or "everyone" in query.lower()
                
                if is_team_query and is_privileged:
                    logger.info(f"📍 FILTERING: Showing team attendance for org_id: {request.org_id}")
                    a_query = a_query.eq("org_id", request.org_id)
                else:
                    a_query = a_query.eq("employee_id", user_id)
                
                # If asking about today, filter to today
                if is_today_query:
                    a_query = a_query.eq("date", today)
                
                recs = (await a_query.order("date", desc=True).limit(100).execute()).data
                data_integrity["count"] = len(recs)
                
                if recs:
                    # Check for gaps in dates (simplified check)
                    if len(recs) < 5 and not is_today_query:
                         data_integrity["completeness"] = "low_data_warning"

                    # If asking about today specifically, show detailed time
                    if is_today_query and recs:
                        today_rec = recs[0]
                        clock_in_time = today_rec.get('clock_in')
                        clock_out_time = today_rec.get('clock_out')
                        if clock_in_time:
                            data_context = f"Here is the attendance for today ({today_rec.get('date')}):\n- Clock In: {clock_in_time}\n- Clock Out: {clock_out_time or 'Still clocked in'}"
                        else:
                            data_context = f"You have not clocked in today ({today})."
                    else:
                        present_count = len([r for r in recs if r.get('clock_in')])
                        
                        # GAP FIX: Summarize if list is too long (> 7 days)
                        if len(recs) > 7:
                            data_context = f"Attendance Summary:\n- Total Days Present (Recent): {present_count}\n- Latest Activity: {recs[0].get('date')} (In: {recs[0].get('clock_in')})\n\nPlease specify a date range for detailed logs."
                        else:
                            att_list = "\n".join([f"- {r.get('date')}: In {r.get('clock_in')}, Out {r.get('clock_out') or 'Still In'}" for r in recs[:10]])
                            data_context = f"Attendance Summary:\n- Total Days Present: {present_count}\n\nRecent History:\n{att_list}"
                else:
                    data_context = "No attendance records found."
            except Exception as e:
                data_context = f"Error fetching attendance: {e}"

        # 4. HIRING / JOBS (Real Implementation)
        elif action in ["get_hiring_overview", "get_jobs", "get_candidates"]:
            try:
                if action == "get_jobs":
                    j_res = await supabase.table("jobs").select("title, department, status, location").eq("org_id", request.org_id).execute()
                    if j_res.data:
                        j_list = "\n".join([f"- {j['title']} ({j['department']}) - Status: {j['status']}" for j in j_res.data])
                        data_context = f"Here are the current job openings:\n{j_list}"
                    else:
                        data_context = "No open job positions found in the database."
                
                elif action == "get_candidates":
                    c_res = await supabase.table("candidates").select("full_name, job_title, status").eq("org_id", request.org_id).execute()
                    if c_res.data:
                        c_list = "\n".join([f"- {c['full_name']} for {c['job_title']} - Status: {c['status']}" for c in c_res.data])
                        data_context = f"Here are the active candidates:\n{c_list}"
                    else:
                        data_context = "No candidate records found."
                
                else: # get_hiring_overview
                    j_count = (await supabase.table("jobs").select("id", count="exact").eq("org_id", request.org_id).execute()).count or 0
                    c_count = (await supabase.table("candidates").select("id", count="exact").eq("org_id", request.org_id).execute()).count or 0
                    data_context = f"Hiring Overview:\n- Open Positions: {j_count}\n- Active Candidates: {c_count}\n\nYou can ask for more details about 'jobs' or 'candidates' specifically."
            except Exception as e:
                logger.error(f"Hiring Data Error: {e}")
                data_context = "I couldn't fetch hiring data at this moment. The 'jobs' or 'candidates' tables might not be fully configured."

        # 5. USER PROFILE (Compliance with "What is my job title?")
        elif action == "get_my_profile":
            try:
                p_res = await supabase.table("profiles").select("*").eq("id", user_id).execute()
                if p_res.data:
                    p = p_res.data[0]
                    data_context = f"USER_PROFILE_DATA:\n- Name: {p.get('full_name')}\n- Job Title: {p.get('role')}\n- Email: {p.get('email')}\n- Organization: {p.get('org_id')}"
                else:
                    data_context = "I couldn't find your profile in the database."
            except Exception as e:
                 data_context = f"Error fetching profile: {e}."
 
        # 3. LEAVES & BALANCE (Enhanced)
        elif action in ["get_pending_leaves", "get_leave_balance"]:
            try:
                # Always fetch profile balance first for context
                p_resp = await supabase.table("profiles").select("leaves_remaining, monthly_leave_quota, leaves_taken_this_month").eq("id", user_id).execute()
                profile = p_resp.data[0] if p_resp.data else None
                logger.info(f"📊 Profile fetched for {user_id}: {profile}")
                
                # Fetch leave requests
                l_query = supabase.table("leaves").select("from_date, to_date, reason, status, employee_id")
                
                if "team" not in query.lower() and "everyone" not in query.lower():
                    l_query = l_query.eq("employee_id", user_id)
                
                leaves = (await l_query.order("from_date", desc=True).limit(10).execute()).data
                data_integrity["count"] = len(leaves) if leaves else 0
                if profile and (profile.get('leaves_remaining') is None):
                    data_integrity["completeness"] = "missing_balance_field"
                
                # Format Balance (Very Explicit for LLM)
                balance_str = ""
                if profile:
                    rem = profile.get('leaves_remaining', 0)
                    quota = profile.get('monthly_leave_quota', 0)
                    taken = profile.get('leaves_taken_this_month', 0)
                    balance_str = f"Your Leave Balance:\n- Available Allowance: {rem} days\n- Monthly Quota: {quota} days\n- Leaves Taken This Month: {taken} days\n"

                if leaves:
                    l_list = "\n".join([f"- {l.get('reason')} ({l.get('from_date')} to {l.get('to_date')}) - Status: {l.get('status')}" for l in leaves])
                    data_context = f"{balance_str}\nRecent Leave History:\n{l_list}"
                else:
                    data_context = f"{balance_str}\nRecent Leave History: None found."
            except Exception as e:
                data_context = f"Error fetching leaves: {e}"
        
        # 5. NOTIFICATIONS (Enhanced)
        elif action == "get_notifications":
            try:
                # Use correct column 'receiver_id' as verified from schema
                n_res = await supabase.table("notifications").select("*").eq("receiver_id", user_id).order("created_at", desc=True).limit(10).execute()
                
                recs = n_res.data
                if recs:
                    n_list = []
                    for r in recs:
                        sender = r.get('sender_name') or "System"
                        msg = r.get('message') or "No content"
                        status = "Read" if r.get('is_read') else "UNREAD"
                        time_str = (r.get('created_at') or '')[:16].replace('T', ' ')
                        n_list.append(f"- [{status}] {sender}: {msg} ({time_str})")
                    
                    data_context = f"Here are your most recent notifications from the database:\n" + "\n".join(n_list)
                else:
                    data_context = "No notifications found for your user ID in the database."
            except Exception as e:
                logger.error(f"Error fetching notifications: {e}")
                data_context = f"Error querying notifications: {str(e)}"

        # 6. ORG HIERARCHY
        elif action == "get_org_hierarchy":
            try:
                h_res = await supabase.table("profiles").select("id, full_name, role, job_title").order("full_name").execute()
                all_profiles = h_res.data or []
                
                user_level = get_role_level(user_role)
                if user_level >= 3:
                    profiles = all_profiles
                else:
                    my_proj_res = await supabase.table("project_members").select("project_id").eq("user_id", user_id).execute()
                    my_project_ids = {m["project_id"] for m in (my_proj_res.data or []) if m.get("project_id")}
                    if not my_project_ids:
                        profiles = [p for p in all_profiles if str(p.get("id")) == str(user_id)]
                    else:
                        m_res = await supabase.table("project_members").select("user_id, project_id").execute()
                        team_user_ids = {m["user_id"] for m in (m_res.data or []) if m.get("project_id") in my_project_ids}
                        profiles = [p for p in all_profiles if str(p.get("id")) in team_user_ids]
                        
                if profiles:
                    # Grouping by role
                    hierarchy = {}
                    for p in profiles:
                        role = p.get('role', 'Other').title().replace('_', ' ')
                        if role not in hierarchy:
                            hierarchy[role] = []
                        hierarchy[role].append(f"{p.get('full_name')} ({p.get('job_title', 'N/A')})")
                    
                    h_list = []
                    # Define order
                    order = ["Executive", "Manager", "Team Lead", "Employee", "Other"]
                    for role_name in order:
                        if role_name in hierarchy:
                            h_list.append(f"**{role_name}s:**")
                            for m in hierarchy[role_name]:
                                h_list.append(f"  - {m}")
                            del hierarchy[role_name]
                    
                    # Any remaining roles
                    for role_name, members in hierarchy.items():
                        h_list.append(f"**{role_name}:**")
                        for m in members:
                            h_list.append(f"  - {m}")
                    
                    data_context = "ORGANIZATION_HIERARCHY_DATA:\n" + "\n".join(h_list)
                else:
                    data_context = "No organization structure found in the database."
            except Exception as e:
                logger.error(f"Error fetching hierarchy: {e}")
                data_context = f"Error querying organization structure: {str(e)}"

        # 7. PROJECT HIERARCHY
        elif action == "get_project_hierarchy":
            try:
                # Fetch all projects, members and profiles
                p_res = await supabase.table("projects").select("*").execute()
                m_res = await supabase.table("project_members").select("*").execute()
                pr_res = await supabase.table("profiles").select("id, full_name").execute()
                
                all_projects = p_res.data or []
                members = m_res.data or []
                profiles = {p['id']: p['full_name'] for p in (pr_res.data or [])}
                
                user_level = get_role_level(user_role)
                if user_level >= 3:
                    projects = all_projects
                else:
                    my_project_ids = {m["project_id"] for m in members if str(m.get("user_id")) == str(user_id)}
                    projects = [p for p in all_projects if p.get("id") in my_project_ids]
                
                if projects:
                    p_list = []
                    for proj in projects:
                        p_name = proj.get('name', 'Unnamed Project')
                        p_list.append(f"### Project: {p_name}")
                        
                        # Get members for this project
                        p_members = [m for m in members if m['project_id'] == proj['id']]
                        
                        # Group members by role
                        role_groups = {}
                        for m in p_members:
                            r = m.get('role', 'Member').title().replace('_', ' ')
                            u_name = profiles.get(m['user_id'], "Unknown User")
                            if r not in role_groups:
                                role_groups[r] = []
                            role_groups[r].append(u_name)
                        
                        if not role_groups:
                            p_list.append("  - (No members assigned)")
                        else:
                            # Preferred order for display
                            for r_name in ["Manager", "Project Manager", "Team Lead", "Employee"]:
                                if r_name in role_groups:
                                    p_list.append(f"  **{r_name}s:**")
                                    for user in role_groups[r_name]:
                                        p_list.append(f"    - {user}")
                                    del role_groups[r_name]
                            
                            for r_name, users in role_groups.items():
                                p_list.append(f"  **{r_name}s:**")
                                for user in users:
                                    p_list.append(f"    - {user}")
                        p_list.append("") # Spacer
                    
                    data_context = "PROJECT_HIERARCHY_DATA:\n" + "\n".join(p_list)
                else:
                    data_context = "No projects found in the database."
            except Exception as e:
                logger.error(f"Error fetching project hierarchy: {e}")
                data_context = f"Error querying project structure: {str(e)}"

        # 8. EVENTS
        elif action == "get_events":
            try:
                # ... (existing event fetching logic)
                e_query = supabase.table("events").select("*")
                if request.org_id:
                    e_query = e_query.eq("org_id", request.org_id)
                if request.project_id:
                    e_query = e_query.eq("project_id", request.project_id)
                recs = (await e_query.order("start_time", desc=False).limit(10).execute()).data
                if recs:
                    event_list = "\n".join([f"- {r.get('title')} ({r.get('start_time')} to {r.get('end_time')})" for r in recs])
                    data_context = f"Here are the upcoming events:\n{event_list}"
                else:
                    data_context = "No events found matching the criteria."
            except Exception as e:
                data_context = f"Error querying events: {str(e)}"

        elif action == "get_project_documents":
            try:
                found_docs = []
                logger.info(f"📁 get_project_documents: Searching for project_id={request.project_id}, org_id={request.org_id or org_id}")
                
                # Try Project level
                if request.project_id:
                    d_res = await supabase.table("documents").select("title, id").eq("project_id", request.project_id).execute()
                    if d_res.data: 
                        found_docs = d_res.data
                        logger.info(f"✅ Found {len(found_docs)} docs at project level")
                
                # Try Org level if still empty
                if not found_docs and (request.org_id or org_id):
                    target_org = request.org_id or org_id
                    d_res = await supabase.table("documents").select("title, id").eq("org_id", target_org).execute()
                    if d_res.data: 
                        found_docs = d_res.data
                        logger.info(f"✅ Found {len(found_docs)} docs at org level ({target_org})")
                
                # Try Global Fallback if still empty
                if not found_docs:
                    logger.info("⚠️ No docs found at project/org level, trying global search...")
                    d_res = await supabase.table("documents").select("title, id").execute()
                    if d_res.data: 
                        found_docs = d_res.data
                        logger.info(f"✅ Found {len(found_docs)} docs globally")
                
                if found_docs:
                    d_list = "\n".join([f"- {d.get('title')} (@{d.get('title').replace(' ', '_')})" for d in found_docs])
                    data_context = f"The following documents are available in the current context:\n{d_list}\n\nYou can ask me specific questions about them by using the @tag!"
                else:
                    logger.warning("❌ No documents found in database at all!")
                    data_context = "I couldn't find any documents attached to this project or organization in the database."
            except Exception as e:
                logger.error(f"Error in get_project_documents: {e}")
                data_context = f"Error fetching documents: {e}"

        # 10. ANALYTICS (Cross-Module Insights)
        elif action == "get_analytics":
            try:
                # Fetch Tasks Progress
                t_res = await supabase.table("tasks").select("status").eq("assigned_to", user_id).execute()
                tasks = t_res.data or []
                total_tasks = len(tasks)
                completed_tasks = len([t for t in tasks if t.get("status") == "completed"])
                pending_tasks = total_tasks - completed_tasks
                
                # Fetch Attendance Consistency (Last 30 days)
                a_res = await supabase.table("attendance").select("date").eq("employee_id", user_id).limit(30).execute()
                attendance = a_res.data or []
                working_days = len(attendance)
                
                # Fetch Leave Balance
                p_res = await supabase.table("profiles").select("leaves_remaining").eq("id", user_id).execute()
                leaves_rem = p_res.data[0].get("leaves_remaining", 0) if p_res.data else 0
                
                data_context = f"""
                ANALYTICAL_SUMMARY for {app_name.title()}:
                - Task Completion: {completed_tasks}/{total_tasks} tasks done ({pending_tasks} pending).
                - Attendance: {working_days} active days recorded in the last 30 days.
                - Leave Security: {leaves_rem} days currently remaining in balance.
                
                This data allows you to provide insights on productivity trends and work-life balance.
                """
                logger.info("📊 Rule 4 Check: Analytics context generated.")
            except Exception as e:
                logger.error(f"Analytics Error: {e}")
                data_context = f"I encountered an error while synthesizing your analytics: {str(e)}"

        elif action == "present_rag":
            data_context = f"RAG_DOCUMENT_NAME: {request.rag_source}\nSOURCE: {request.rag_source}\nCONTENT: {request.rag_content}"

        elif action == "chat":
            data_context = params.get("llm_response") or "I am a helpful assistant. How can I assist you today? If you have questions about specific documents, please use '@document_name' to tag them!"

        elif action == "greeting":
            data_context = "The user is saying hello. Greet them professionally and offer assistance with HR, Tasks, or Documents."

        else:
            data_context = f"ACTION_DETECTED: {action}. Please respond based on the data context or offer general assistance."
            
        # --- RULE 14: NO HALLUCINATION CHECK ---
        # If data_context is empty or indicates no data, return immediately
        no_data_indicators = [
            "No records found", "No data found", "couldn't find any", 
            "No tasks found", "No attendance records", "No events found",
            "No documents", "No members found", "No open job positions",
            "No candidate records", "couldn't find your profile"
        ]
        
        if any(indicator in data_context for indicator in no_data_indicators):
            logger.info("🛡️ RULE 14: No data found, returning explicit message")
            return SLMQueryResponse(
                response=f"I checked the database, but {data_context.lower()}",
                action=action,
                data={"no_data": True}
            )
            
        # --- RULE 12 STRICT ENFORCEMENT ---
        if data_integrity.get("completeness") == "partial":
            logger.info("🛡️ RULE 12 INTERCEPT: Prefixing data payload with completeness warning")
            missing = data_integrity.get("missing_fields", "some relevant fields")
            data_context = f"WARNING [RULE 12]: The following data is incomplete because {missing} are missing.\n\n{data_context}"
            
        # --- LLM RESPONSE SYNTHESIS ---
        # No more "Fast Path" returns. Every response is synthesized by the LLM to ensure
        # insight-driven summaries and compliance with all rules (Rule 9, 11, etc).

        response_prompt = f"""### SYSTEM ROLE
You are the {app_name.title()} AI Assistant.

This prompt applies when the user’s question relates to:
- My Tasks
- Team Tasks
- Analytics
- Project Documents / Knowledge Base

Your responsibility is to provide insight-driven, role-safe, and data-backed responses while strictly following product rules.

Core Rules:

1. Always identify the relevant module (My Tasks, Team Tasks, or Analytics) and the user role (Employee, Team Lead, Manager, Executive) before responding.

2. Enforce Role-Based Access Control (RBAC) strictly:
   - Employees can access only their own tasks and analytics.
   - Team Leads can access their own tasks, team tasks, and team-level analytics.
   - Managers can access employee tasks and cross-team analytics.
   - Executives can access organization-level analytics only.

3. Never expose data outside the user’s authorized scope, including during comparisons, summaries, or explanations.

4. If the requested information is already clearly visible in the current UI/module, redirect the user to that module instead of repeating raw data.

5. If the information is not directly visible or requires reasoning, provide a clear, concise, and meaningful summary or explanation based on the data.

6. You must support simple, complex, comparative, and analytical questions related to tasks and analytics.

7. You may analyze and compare data across multiple tables, columns, users, projects, and time periods when required, while remaining within RBAC scope.

8. For Analytics-related questions:
   - Do not act as a conversational dashboard.
   - Do not repeat charts, tables, or raw metrics that already exist in the Analytics UI.
   - Provide explanations, trends, patterns, and reasoning instead of raw numbers.

9. **ACTION OVER NAVIGATION (Rule 9):**
   - DO NOT return raw markdown tables of tasks, documents, or lists unless explicitly requested.
   - You MUST summarize the data findings into insightful, concise bullet points (under 3 or 4 sentences max).
   - Explain the "why" instead of just repeating the "what".

10. For ranking or performance-related questions:
    - Do not provide raw rankings immediately.
    - Ask clarifying questions or explain performance dimensions (planning, delivery, quality, time period) before concluding.

11. **AMBIGUITY (Rule 8):** If the user's question is incomplete or ambiguous (e.g., missing a time range, specific employee, project name, or metric), you MUST NOT guess. Instead, ask a specific clarifying follow-up question to narrow down the context.
    - *Example:* If they ask "How is the team performing?", ask "Over which time period (this week/month) or for which specific project?"

12. **INSUFFICIENT DATA (Rule 12):** If data exists but is insufficient to provide a accurate answer, or if some fields are null, clearly state: "I have data for [part], but I am missing [part] to give you a full answer." NEVER infer or assume missing values.
    - **CRITICAL:** Check the Data Quality Integrity field below. If it shows "low_data_warning" or "completeness": "partial", you MUST acknowledge this in your response.

13. Always respond in a professional, clear, and structured manner. Use bullet points for readability.

14. **NO HALLUCINATION:** If the DATABASE_CONTEXT is empty or "No records found," explicitly state that the information is unavailable in the database.

Your objective:
Provide accurate, role-safe, and insight-driven responses that help users understand "why" and "what to do next." If data is missing or a query is vague, prioritizing CLARIFICATION over GUESSTIMATION is mandatory for 100% compliance.

### CONTEXT FOR THIS RESPONSE
- User Role: __USER_ROLE__
- Data Quality Integrity: __DATA_INTEGRITY__
- Relevant Data Found: __DATA_CONTEXT__

### USER QUERY
__QUERY__
"""
        response_prompt = response_prompt.replace("__USER_ROLE__", str(request.user_role))
        response_prompt = response_prompt.replace("__DATA_INTEGRITY__", json.dumps(data_integrity))
        response_prompt = response_prompt.replace("__DATA_CONTEXT__", str(data_context))
        response_prompt = response_prompt.replace("__QUERY__", str(query))

        gen_start = time.perf_counter()
        ttft = 0.0
        try:
            friendly_response_stream = await together_client.chat.completions.create(
                model="meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
                messages=[
                    {"role": "system", "content": response_prompt},
                    {"role": "user", "content": query}
                ],
                temperature=0.0, # Lowered for deterministic delivery
                max_tokens=300,
                timeout=15,  # 15 second timeout
                stream=True
            )
            
            final_response = ""
            async for chunk in friendly_response_stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    if not final_response:
                        ttft = time.perf_counter() - gen_start
                    final_response += chunk.choices[0].delta.content

            total_end = time.perf_counter()
            total_latency = total_end - total_start
            generation_latency = total_end - gen_start
            tokens_generated = len(final_response.split())

            model_label = "RAG" if is_rag_triggered else "SLM"
            log_latency(
                model_label, 
                ttft, 
                total_latency, 
                generation_latency, 
                tokens_generated,
                retrieval_latency=rag_metrics.get("retrieval_latency", 0.0),
                embedding_latency=rag_metrics.get("embedding_latency", 0.0)
            )
        except Exception as e:
            logger.error(f"❌ LLM Response Synthesis Error: {e}")
            total_latency = time.perf_counter() - total_start
            model_label = "RAG" if is_rag_triggered else "SLM"
            log_latency(model_label, 0, total_latency, 0, 0, status="error")
            # Fallback response if LLM fails
            if data_context and "No" not in data_context[:20]:
                final_response = f"Based on the data I found:\n\n{data_context[:500]}"
            else:
                final_response = "I encountered an issue processing your request. Please try again or rephrase your question."
        
        # [CRITICAL FIX] 
        # Only override to "chat" if no specific action was detected.
        if not action or action == "chat":
            action = "chat"
            
        # --- CACHE NEW RESPONSE ---
        if not request.forced_action and final_response:
             # Using background tasks to not block response delivery
             if hasattr(request, 'background_tasks') and request.background_tasks:
                 request.background_tasks.add_task(save_semantic_cache, query, final_response, org_id, user_id, user_role, project_id)
             else:
                 # Fallback for if BackgroundTasks isn't passed through (we should ensure it is)
                 asyncio.create_task(save_semantic_cache(query, final_response, org_id, user_id, user_role, project_id))

        return SLMQueryResponse(
            response=final_response,
            action=action,
            data=params
        )
        
    except Exception as e:
        logger.error(f"SLM Chat Error: {e}")
        return SLMQueryResponse(
            response=f"I encountered an error processing your request. Please try again.",
            action="error",
            data={"error": str(e)}
        )

@app.get("/slm/tasks")
@app.get("/api/tasks")
async def get_tasks(user_id: Optional[str] = None):

    try:
        query = supabase.table("tasks").select("*")
        if user_id:
            query = query.eq("assigned_to", user_id)
        result = await query.limit(50).execute()
        return {"tasks": result.data, "count": len(result.data)}
    except Exception as e:
        return {"tasks": [], "error": str(e)}

@app.get("/slm/attendance")
@app.get("/api/attendance")
async def get_attendance(user_id: Optional[str] = None, date: Optional[str] = None):

    try:
        query = supabase.table("attendance").select("*")
        if user_id:
            query = query.eq("employee_id", user_id)
        if date:
            query = query.eq("date", date)
        result = await query.limit(50).execute()
        return {"attendance": result.data, "count": len(result.data)}
    except Exception as e:
        return {"attendance": [], "error": str(e)}

# =============================================================================
# LLM ENDPOINTS (OpenAI with Guardrails)
# =============================================================================
# LLMQueryRequest and LLMQueryResponse have been moved to 'binding'


# =============================================================================
# USER CONTEXT HELPER
# =============================================================================
async def fetch_user_context(user_id: str) -> Dict[str, Any]:

    context = {
        "user_id": user_id,
        "name": "Unknown User",
        "role": "employee",
        "email": "",
        "project_id": None,
        "project_name": None,
        "org_id": None
    }
    
    try:
        # 1. Fetch Basic Profile
        # switched to 'profiles' as 'users' returned 404
        user_resp = await supabase.table("profiles").select("*").eq("id", user_id).limit(1).execute()
        if user_resp.data:
            user = user_resp.data[0]
            context["name"] = user.get("full_name") or user.get("name", "User")
            context["role"] = user.get("role", "employee")
            context["email"] = user.get("email", "")
            
        # 2. Fetch Active Project
        # Assuming one active project per user for now
        proj_resp = await supabase.table("project_members").select("project_id, projects(name, org_id)").eq("user_id", user_id).limit(1).execute()
        if proj_resp.data:
            membership = proj_resp.data[0]
            context["project_id"] = membership.get("project_id")
            
            # Extract joined project details
            project_details = membership.get("projects")
            if project_details:
                context["project_name"] = project_details.get("name")
                context["org_id"] = project_details.get("org_id") # Often projects are linked to orgs

        # 3. If org_id still missing, check organization_members
        if not context["org_id"]:
             org_resp = await supabase.table("organization_members").select("organization_id").eq("user_id", user_id).limit(1).execute()
             if org_resp.data:
                 context["org_id"] = org_resp.data[0].get("organization_id")

        return context
        
    except Exception as e:
        logger.error(f"Error fetching user context for {user_id}: {e}")
        return context

# Load system prompt for LLM
LLM_SYSTEM_PROMPT = """You are a professional workplace assistant for TalentOps HR platform.
You help with HR-related queries, task management, attendance, leaves, and workplace policies.
Stay focused on workplace topics only. Politely decline non-work related queries.

CURRENT USER CONTEXT:
Name: {user_name}
Role: {user_role}
Project: {project_name}
"""

ORCHESTRATOR_SYSTEM_PROMPT = """You are an intelligent router for the TalentOps ecosystem.
Your job is to analyze the users query and route it to the correct backend system.

Output strictly a JSON object: {"system": "slm" | "rag" | "llm", "reason": "short explanation"}

GUIDELINES:
1. "slm": Use for ANY live action or database query:
   - USER DATA: "my tasks", "my attendance", "my balance", "my notifications", "recent alerts".
   - TEAM/MANAGER DATA: "team tasks", "approve leave", "assign task", "team attendance", "who is in my team".
   - PERSONAL ACTIONS: "Clock me in", "Clock me out", "Apply for leave".
   - ADMINISTRATIVE: "Post announcement", "Create project", "Add user to project".
   - NAVIGATION: "go to leaves page", "open my tasks", "redirect to dashboard", "show me the attendance module".
   - ORGANIZATION: "Org hierarchy", "Who is in the team", "Company structure".
   - PROJECTS: "Project hierarchy", "Project team", "Who is working on project X".
   - HIRING: "Job openings", "Candidates", "Recruitement status".
   - CRITICAL: Anything involving live database records, navigation/redirection, or performing an operation.

2. "rag": Use ONLY for static document knowledge, technical specs, or manuals:
   - "What is the policy for X?", "Information from document Y", "Handbook rules", "SOP guide".
   - "Architecture details", "Technical specs", "How does the system work?", "Module documentation".
   - If the query asks for information found in documents, ALWAYS use RAG.

3. "llm": Use ONLY for general greetings or non-work casual chat.
"""

# Keywords that suggest RAG (Document & Policy Queries)
RAG_KEYWORDS = [
    "policy guide", "handbook", "procedure manual", "holiday rules", "expense policy", 
    "hr guide", "what is the policy", "regulations", "company guidelines", "sop",
    "standard operating procedure", "compliance", "code of conduct", "employee manual",
    "benefits guide", "onboarding guide", "training material", "project documentation",
    "technical specs", "requirements document", "what does the document say",
    "read the policy", "check the handbook", "according to the manual",
    "architecture", "frontend", "backend", "system design", "technical details",
    "module overview", "technical documentation", "search documents", "read document",
    "document content", "tell me about this document", "inside the document",
    "what is in", "what does the doc say", "according to", "manual", "guide", "specs", "specification"
]

# Keywords that suggest SLM (Actions & Data Queries for TalentOps)
SLM_KEYWORDS = [
    # Task Management
    "assign task", "create task", "update task", "delete task", "my tasks", "task status",
    "pending tasks", "completed tasks", "overdue tasks", "task deadline", "task priority",
    
    # Attendance & Time Tracking
    "clock in", "clock out", "my attendance", "attendance history", "mark attendance",
    "check in", "check out", "time log", "working hours", "late today", "am i late",
    "active", "online", "present", "working today", "who is working", "who is active",
    
    # Leave Management
    "apply leave", "request leave", "my leaves", "leave balance", "leave allowance",
    "remaining leaves", "leave history", "cancel leave", "pending leave requests",
    "approve leave", "reject leave", "sick leave", "casual leave", "vacation",
    
    # Team & People
    "my team", "team members", "who is in my team", "team attendance", "team tasks",
    "assigned to me", "assigned to", "team lead", "manager", "colleagues",
    
    # Announcements & Communication
    "post announcement", "broadcast", "send message", "notify team", "announce",
    "create announcement", "company announcement", "notifications", "my alerts",
    "recent notifications", "what are my notifications", "show notifications",
    
    # Documents & Files
    "project documents", "show me project documents", "list files", "my documents", "what documents",
    "view documents", "available documents", "get documents", "show documents",
    
    # Projects
    "create project", "update project", "project status", "my projects", "project members",
    "add member", "remove member", "project deadline",
    
    # Hiring & Recruitment
    "hiring overview", "job openings", "candidates", "applicants", "interview schedule",
    "shortlist candidate", "recruitment status",
    
    # Performance & Reports
    "my performance", "team performance", "attendance report", "task report",
    "productivity", "kpi", "metrics",
    
    # Organization
    "org hierarchy", "org chart", "hierarchy chart", "company structure", "reporting lines",
    "who is in the company", "list all employees", "team structure",
    
    # Navigation & UI (Requirement 4)
    "go to", "open page", "navigate to", "redirect to", "show module", "open module", 
    "show page", "take me to",
    
    # Project Specific Hierarchy
    "project hierarchy", "project team", "who is on the project", "project structure",
    "project leads", "project members"
]

@app.post("/llm/query")
@app.post("/api/llm/query")
async def llm_query(request: LLMQueryRequest):

    start_time = time.perf_counter()
    
    # Rate Limiting (Phase 2.3)
    if not await rate_limiter.consume("llm_global", tokens=1):
        raise HTTPException(status_code=429, detail="Global LLM Rate Limit Exceeded")
        
    ttft = 0.0
    try:
        messages = [
            {"role": "system", "content": LLM_SYSTEM_PROMPT},
            {"role": "user", "content": request.query}
        ]
        
        # Capture streaming for TTFT and token count
        response_stream = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            stream=True
        )
        
        full_content = ""
        tokens_generated = 0
        async for chunk in response_stream:
            if chunk.choices and chunk.choices[0].delta.content:
                if not full_content:
                    ttft = time.perf_counter() - start_time
                full_content += chunk.choices[0].delta.content
                # Simple token approximation (splitting by whitespace)
                # For high precision we could use tiktoken, but requirement says "minimal, clean"
            if chunk.choices and chunk.choices[0].finish_reason:
                pass

        total_latency = time.perf_counter() - start_time
        generation_latency = total_latency - ttft
        tokens_generated = len(full_content.split()) # Rough estimate per requirement
        
        log_latency("LLM", ttft, total_latency, generation_latency, tokens_generated)
        
        return LLMQueryResponse(
            answer=full_content,
            model="gpt-4o-mini",
            tokens_used=tokens_generated,
            persona=request.persona or "hr"
        )
    except Exception as e:
        logger.error(f"LLM Query Error: {e}")
        total_latency = time.perf_counter() - start_time
        log_latency("LLM", 0, total_latency, 0, 0, status="error")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# ORCHESTRATOR (Intelligent Routing)
# =============================================================================
# OrchestratorRequest has been moved to 'binding'

@app.post("/orchestrate")
@app.post("/api/chatbot/query")
async def orchestrate_query(request: OrchestratorRequest, background_tasks: BackgroundTasks):

    logger.info(f"\n{'='*50}")
    logger.info(f"📥 RECEIVED REQUEST FROM FRONTEND")
    logger.info(f"🔎 Query: {request.query}")
    logger.info(f"👤 User ID: {request.user_id}")
    logger.info(f"🏢 Org ID: {request.org_id}")
    logger.info(f"📂 Project ID: {request.project_id}")
    logger.info(f"📝 Context: {request.context}")
    logger.info(f"{'='*50}\n")

    try:
        # --- 0. EXTRACT CONTEXT (CRITICAL FIX) ---
        # If IDs are not top-level, check if they are inside the 'context' dictionary
        if request.context:
            if not request.user_id:
                request.user_id = request.context.get("user_id")
            if not request.project_id:
                request.project_id = request.context.get("project_id")
            if not request.org_id:
                request.org_id = request.context.get("org_id")
            if not request.app_name:
                request.app_name = request.context.get("app_name")

        # 0. Fetch User Context (Personalization)
        user_context = {}
        if request.user_id and request.user_id != 'guest':
            user_context = await fetch_user_context(request.user_id)
            logger.info(f"Loaded context for user {request.user_id}: {user_context.get('name')}")
        
        # Merge explicitly provided context
        if request.context:
            user_context.update(request.context)
            
        # Fill in missing IDs from fetching
        if not request.project_id and user_context.get("project_id"):
            request.project_id = user_context.get("project_id")
        if not request.org_id and user_context.get("org_id"):
            request.org_id = user_context.get("org_id")

        # --- 🚀 LAYER 0.5: SESSION & HISTORY (Phase 2.3) ---
        session_id = f"{request.org_id}:{request.user_id}" if request.org_id else request.user_id or "anonymous"
        state = await get_shared_state_singleton()
        history = await state.get_history(session_id, user_id=request.user_id, org_id=request.org_id)
        # --- 1. DETERMINISTIC ROUTING (Hard Locking) ---
        query_lower = request.query.lower()
        target_system = None
        
        # 0.1 Check for Confirmation (Requirement 9)
        is_yes = any(w in query_lower for w in ["yes", "proceed", "confirm", "do it", "sure", "ok", "okay"])
        pending_action = None
        pending_params = None
        if request.context:
            pending_action = request.context.get("pending_action")
            pending_params = request.context.get("pending_params")

        # --- 🚀 LAYER 0.6: SEMANTIC CACHE LOOKUP (Phase 2.2) ---
        # Skip cache for confirmations or explicit commands
        if not is_yes and "@" not in request.query:
            cached_resp = await check_semantic_cache(request.query, request.org_id, request.user_id, request.project_id)
            if cached_resp:
                total_lat = time.perf_counter() - start_time
                log_latency("CACHE", 0, total_lat, 0, len(cached_resp.split()))
                return {"system": "cache", "response": cached_resp, "action": "chat"}

        if is_yes and pending_action:
            target_system = "slm"
            logger.info(f"✅ CONFIRMED: Executing pending action [{pending_action}]")
        elif any(k in query_lower for k in RAG_KEYWORDS):
            target_system = "rag"
            logger.info("🔒 INTENT LOCKED: Routing to [rag] due to RAG Keywords.")
        elif any(k in query_lower for k in SLM_KEYWORDS):
            target_system = "slm"
            logger.info("🔒 INTENT LOCKED: Routing to [slm] due to Action Keywords.")
        elif "@" in query_lower:
            target_system = "rag"
            logger.info("🔒 INTENT LOCKED: Routing to [rag] due to @mention.")
            
        # 2. SEMANTIC ROUTING (Router LLM Fallback)
        if not target_system:
            logger.info("🤖 Routing decision delegated to Orchestrator LLM...")
            try:
                # Build messages with history for context-aware routing
                router_messages = [{"role": "system", "content": ORCHESTRATOR_SYSTEM_PROMPT}]
                # Add last 3 turns of history for context
                for h in history[-3:]:
                    router_messages.append(h)
                router_messages.append({"role": "user", "content": request.query})

                router_resp = await openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=router_messages,
                    response_format={"type": "json_object"}
                )
                router_json = json.loads(router_resp.choices[0].message.content)
                target_system = router_json.get("system", "llm").lower()
                
                # Rule 5 Enforcement: REMOVED per user request
                # No longer re-routing to [llm] if @ is missing.
            except Exception as e:
                logger.error(f"Router Error: {e}")
                target_system = "llm"
            
        logger.info(f"Orchestrator routed '{request.query}' to [{target_system}]")
        
        # 2. Route to the appropriate handler
        if target_system == "slm":
            # Call SLM with full context
            slm_context = user_context.copy()
            
            # Prepare confirmation flags
            is_confirmed = False
            p_action = None
            p_params = None
            
            if is_yes and pending_action:
                is_confirmed = True
                p_action = pending_action
                p_params = pending_params
                # We also need to pass the original query if we want to re-parse, 
                # but better to use the pending action name directly.
                # If we are confirming, the "query" can be "yes", so we need to pass the pending intent.
                query_to_send = f"Perform {pending_action} with {json.dumps(p_params)}"
            else:
                query_to_send = request.query

            slm_req = SLMQueryRequest(
                query=query_to_send,
                user_id=request.user_id,
                project_id=request.project_id,
                org_id=request.org_id,
                user_role=user_context.get("role", "employee"), 
                context=slm_context,
                is_confirmed=is_confirmed,
                pending_action=p_action,
                pending_params=p_params,
                history=history,
                app_name=request.app_name
            )
            slm_resp = await slm_chat(slm_req, background_tasks)
            
            # Save to history (Phase 2.3)
            await state.add_history(session_id, request.user_id, "user", request.query, org_id=request.org_id)
            await state.add_history(session_id, request.user_id, "assistant", slm_resp.response, org_id=request.org_id)
            
            # Add feedback request to action responses (Requirement 14)
            if slm_resp.action in ["chat", "success"]:
                slm_resp.response += "\n\n*Was this what you wanted?*"
                
            return slm_resp
            
            # slm_text = slm_resp.response if hasattr(slm_resp, 'response') else str(slm_resp)
            
            # # --- HYBRID FALLBACK ---
            # # If SLM says "NO_DATA_FOUND_IN_DB" and the query might be document-related, try RAG
            # if "NO_DATA_FOUND_IN_DB" in slm_text:
            #     logger.info("⚠️ SLM returned NO_DATA. Attempting RAG fallback...")
            #     if request.org_id:
            #         rag_req = RAGQueryRequest(
            #             question=request.query,
            #             org_id=request.org_id,
            #             project_id=request.project_id
            #         )
            #         rag_resp = await rag_query(rag_req)
                    
            #         # If RAG found something meaningful (simple heuristic)
            #         if rag_resp and "answer" in rag_resp and len(rag_resp["answer"]) > 50:
            #              logger.info("✅ RAG fallback SUCCESSFUL.")
            #              return {
            #                 "system": "rag-fallback",
            #                 "response": rag_resp.get("answer"),
            #                 "sources": rag_resp.get("sources"),
            #                 "action": "chat"
            #              }
            
            # result = {
            #     "system": "slm",
            #     "response": slm_text, 
            #     "action": "chat" 
            # }
            
            # logger.info(f"📤 SENDING RESPONSE TO FRONTEND: {result}")
            # return result

        elif target_system == "rag":
            # Extract document name from @mention
            doc_name = "general"
            if "@" in query_lower:
                parts = query_lower.split("@")
                if len(parts) > 1:
                    doc_name = parts[1].split()[0]

            rag_req = RAGQueryRequest(
                question=request.query,
                org_id=request.org_id,
                project_id=request.project_id
            )
            rag_resp = await rag_query(rag_req)
            
            # REQUIREMENT 0: SLM delivers the answer
            logger.info(f"🔍 RAG Answer received: {len(rag_resp.get('answer', ''))} chars. Sources: {rag_resp.get('sources')}")
            
            slm_context = user_context.copy()
            cleaned_query = re.sub(r'@[a-zA-Z0-9_]+', '', request.query).strip()
            
            slm_req = SLMQueryRequest(
                query=cleaned_query,
                user_id=request.user_id,
                project_id=request.project_id,
                org_id=request.org_id,
                user_role=user_context.get("role", "employee"), 
                context=slm_context,
                forced_action="present_rag",
                rag_content=rag_resp.get("answer"),
                rag_source=", ".join(rag_resp.get("sources", [])) if rag_resp.get("sources") else "Database",
                history=history
            )
            slm_resp = await slm_chat(slm_req, background_tasks)
            
            # Save to history (Phase 2.3)
            await state.add_history(session_id, request.user_id, "user", request.query, org_id=request.org_id)
            await state.add_history(session_id, request.user_id, "assistant", slm_resp.response, org_id=request.org_id)
            
            return slm_resp
            
        else:
            # Call LLM for Guardrails/Domain knowledge
            personalized_prompt = LLM_SYSTEM_PROMPT.format(
                user_name=user_context.get("name", "User"),
                user_role=user_context.get("role", "employee"),
                project_name=user_context.get("project_name", "None")
            )
            
            # Build messages with FULL history for memory
            messages = [{"role": "system", "content": personalized_prompt}]
            for h in history:
                messages.append({"role": h["role"], "content": h["content"]})
            messages.append({"role": "user", "content": request.query})
            
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.3
            )
            llm_text = response.choices[0].message.content

            # REQUIREMENT 0: SLM delivers the answer
            slm_context = user_context.copy()
            slm_req = SLMQueryRequest(
                query=request.query,
                user_id=request.user_id,
                project_id=request.project_id,
                org_id=request.org_id,
                user_role=user_context.get("role", "employee"), 
                context=slm_context,
                forced_action="chat",
                pending_params={"llm_response": llm_text}, # Pass LLM text as parameter
                history=history
            )
            
            # In slm_chat, if action is "chat", it will look at context for answer
            # We should update slm_chat's chat handler to use this.
            slm_resp = await slm_chat(slm_req, background_tasks)
            
            # Save to history
            await state.add_history(session_id, user_id, "user", request.query, org_id=request.org_id)
            await state.add_history(session_id, user_id, "assistant", slm_resp.response, org_id=request.org_id)
            
            return slm_resp

    except Exception as e:
        logger.error(f"Orchestrator Error: {e}")
        return {"system": "error", "response": f"I encountered an error trying to process that: {str(e)}"}


# =============================================================================
# RAG ENDPOINTS (Document Ingestion & Query)
# =============================================================================
# RAGIngestRequest and RAGQueryRequest have been moved to 'binding'

# RAG utility functions (chunk_text, get_embeddings, parse_file_from_url) 
# have been moved to 'binding'

@app.post("/rag/ingest")
@app.post("/docs/ingest")
async def rag_ingest(request: RAGIngestRequest):

    try:
        # --- DB CONTEXT SWITCHING (FIX 3: centralized via select_client) ---
        app_name = (request.app_name or request.metadata.get("app_name") or "talentops").lower()
        _client_error = select_client(app_name)
        if _client_error == "COHORT_UNAVAILABLE":
            return {"success": False, "message": "The Cohort service is not currently available."}
        doc_id = request.doc_id or request.metadata.get('doc_id')
        org_id = request.org_id or request.metadata.get('org_id')
        project_id = request.project_id or request.metadata.get('project_id')
        
        if not org_id or not doc_id:
            return {"success": False, "message": "Missing org_id or doc_id"}
        
        # 1. Extract text from URL if provided
        file_text = ""
        if request.file_url:
            file_text = parse_file_from_url(request.file_url)
            
        full_text = (request.text or "") + "\n\n" + file_text
        full_text = full_text.strip()
        
        if len(full_text) < 5:
            return {"success": False, "message": "Text content too short or empty mapping"}
        
        # 2. Upsert parent document in 'documents' table
        try:
             await supabase.table("documents").insert({
                 "id": doc_id,
                 "org_id": org_id,
                 "project_id": project_id,
                 "title": request.metadata.get("title", "Uploaded Document")
             }).execute()
        except Exception as e:
             # Might fail if already exists, that's fine
             logger.info(f"Note: Document parent entry check: {e}")

        # 3. Chunk and embed
        chunks = chunk_text(full_text)
        embeddings_res = await get_embeddings(chunks)
        embeddings, embedding_latency = embeddings_res if isinstance(embeddings_res, tuple) else (embeddings_res, 0)
        
        if not chunks or not embeddings:
            return {"success": False, "message": "Failed to process document"}
        
        # Store in Supabase
        records = []
        for i, chunk in enumerate(chunks):
            records.append({
                "document_id": doc_id,
                "org_id": org_id,
                "project_id": project_id,
                "content": chunk,
                "embedding": embeddings[i]
            })
            
        # Bulk insert
        resp = await supabase.table("document_chunks").insert(records).execute()
        
        return {
            "success": True, 
            "chunks": len(chunks), 
            "message": f"Processed and stored {len(chunks)} chunks"
        }
        
    except Exception as e:
        logger.error(f"RAG Ingest Error: {e}")
        return {"success": False, "message": str(e)}

@app.post("/rag/query")
@app.post("/query")
async def rag_query(request: RAGQueryRequest):
    start_time = time.perf_counter()
    embedding_latency = 0.0
    retrieval_latency = 0.0

    try:
        # --- DB CONTEXT SWITCHING (FIX 3: centralized via select_client) ---
        app_name = (request.app_name or "talentops").lower()
        _client_error = select_client(app_name)
        if _client_error == "COHORT_UNAVAILABLE":
            return {"answer": "The Cohort service is not currently available.", "sources": []}

        # 🚀 PARALLELIZED EXECUTION BLOCK
        # We start metadata fetch and embedding generation simultaneously
        logger.info("⚡ Starting Parallel RAG Retrieval...")
        
        async def fetch_metadata():
            try:
                # Use current Supabase context
                query = supabase.table("documents").select("id, title, org_id, project_id, user_id")
                query = query.eq("org_id", request.org_id)
                
                # Filter by user_id or global (null)
                if request.user_id:
                     # Use the newly added in_ filter
                     query = query.in_("user_id", [request.user_id, "null"])
                
                resp = await query.execute()
                if resp.error:
                    # If user_id column doesn't exist yet, fallback to just org_id
                    logger.warning(f"RAG Filter Error: {resp.error}. Falling back to Org-level fetch.")
                    resp = await supabase.table("documents").select("id, title, org_id, project_id").eq("org_id", request.org_id).execute()
                return resp.data or []
            except Exception as e:
                logger.error(f"Error fetching existing doc metadata: {e}")
                return []

        # Parallelize: 1. Metadata, 2. Embedding
        metadata_task = fetch_metadata()
        embedding_task = get_embeddings([request.question])
        
        all_docs, (q_emb, emb_lat) = await asyncio.gather(metadata_task, embedding_task)
        embedding_latency = emb_lat

        # 1. Process Metadata for title matching
        doc_filters = {}
        all_doc_map = {}
        if all_docs:
            # Sort by title length descending to match longest (most specific) title first
            all_docs.sort(key=lambda x: len(x.get('title', '')), reverse=True)
            
            q_norm = re.sub(r'[^a-z0-9]', '', request.question.lower())
            logger.info(f"🔍 Normalized Query for Matching: {q_norm}")
            for d in all_docs:
                title = d.get('title', '')
                t_id = d.get('id')
                all_doc_map[t_id] = title
                t_norm = re.sub(r'[^a-z0-9]', '', title.lower())
                
                if t_norm and t_norm in q_norm:
                    doc_filters["document_id"] = t_id
                    # CRITICAL: Use the document's actual org_id for chunk fetching
                    doc_filters["org_id"] = d.get("org_id")
                    doc_filters["project_id"] = d.get("project_id")
                    logger.info(f"🎯 MATCH FOUND: '{title}' ({t_id}) matched")
                    break

        # 2. Strategy: Direct Fetch vs Vector Search
        target_doc_id = doc_filters.get("document_id")
        final_matches = []
        
        if target_doc_id:
            logger.info(f"Directly fetching chunks for Document: {target_doc_id}")
            # Use current Supabase context - and importantly, use the correct document ID and potentially ignore org_id if mismatched
            # We filter only by document_id here since it is a unique UUID
            resp = await supabase.table("document_chunks").select("content, document_id").eq("document_id", target_doc_id).execute()
            if resp.data:
                chunks = resp.data
                logger.info(f"Retrieved {len(chunks)} shards from document {target_doc_id}")
                for c in chunks:
                    final_matches.append({
                        "id": c.get('document_id'),
                        "content": c.get('content')
                    })
            
        # If no specific doc was mentioned OR direct fetch failed, use Vector Search
        if not final_matches:
            q_emb, embedding_latency = await get_embeddings([request.question])
            if q_emb:
                query_vector = q_emb[0]
                params = {
                    "query_embedding": query_vector,
                    "match_threshold": 0.01, 
                    "match_count": 20,
                    "filter": {
                        "org_id": request.org_id,
                        "project_id": request.project_id
                    }
                }
                rpc_resp = await supabase.rpc("match_documents", params)
                matches = rpc_resp.data if rpc_resp.data else []
                for m in matches:
                    final_matches.append({
                        "id": m.get('id'), # In RPC result, 'id' is the parent document ID
                        "content": m.get('content')
                    })
            else:
                return {"answer": "Failed to generate embedding", "sources": []}

        # 4. Format context with titles
        context_text = ""
        unique_sources = []
        
        # Limit to 15 chunks to avoid overwhelming context window
        for item in final_matches[:15]:
            d_id = item.get('id')
            title = all_doc_map.get(d_id, "Unknown Document")
            context_text += f"---\n[SOURCE: {title}]\n{item.get('content', '')}\n"
            unique_sources.append(title)
            
        if not context_text:
            context_text = "No relevant document sections were found in the database."

        retrieval_latency = (time.perf_counter() - start_time) - embedding_latency
        
        # 5. Return Raw Context for SLM Delivery (Requirement 0)
        return {
            "answer": context_text,
            "sources": sorted(list(set(unique_sources))),
            "metrics": {
                "embedding_latency": embedding_latency,
                "retrieval_latency": retrieval_latency,
                "total_rag_latency": time.perf_counter() - start_time
            }
        }
        
    except Exception as e:
        logger.error(f"RAG Query Error: {e}")
        return {
            "answer": "Error processing query", 
            "sources": [], 
            "error": str(e),
            "metrics": {"embedding_latency": 0.0, "retrieval_latency": 0.0}
        }

# =============================================================================
# STARTUP
# =============================================================================
@app.on_event("startup")
async def startup():
    logger.info("=" * 60)
    logger.info("Modal Gateway - Unified Server v2.0")
    logger.info(f"Running on port {PORT}")
    logger.info("=" * 60)
    logger.info("Available endpoints:")
    logger.info("  GET  /              - Root")
    logger.info("  GET  /health        - Health check")
    logger.info("  POST /slm/chat      - SLM Chatbot")
    logger.info("  POST /llm/query     - OpenAI LLM")
    logger.info("  POST /rag/query     - RAG Query")
    logger.info("  POST /rag/ingest    - RAG Ingest")
    logger.info("=" * 60)

if __name__ == "__main__":
    print("=" * 60)
    print("Modal Gateway - Unified Server v2.0")
    print(f"Starting on http://0.0.0.0:{PORT}")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=PORT)
