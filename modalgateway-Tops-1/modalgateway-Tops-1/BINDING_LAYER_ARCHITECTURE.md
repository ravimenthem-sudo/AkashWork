# Binding Layer Extraction & Architectural Decision Record
## TalentOps ModelGateway

**Document Version:** 1.0  
**Date:** 2026-02-20  
**Status:** Finalized  
**Prepared By:** Engineering Team — TalentOps Platform  
**Scope:** Infrastructure Extraction Only — No Business Logic Changes

---

## Table of Contents

1. [Background & Objective](#1-background--objective)
2. [Clarification & Question Resolution Log](#2-clarification--question-resolution-log)
3. [Architecture Before Extraction](#3-architecture-before-extraction)
4. [Architecture After Extraction](#4-architecture-after-extraction)
5. [Files & Code Extracted](#5-files--code-extracted)
6. [Before vs After Application Behavior](#6-before-vs-after-application-behavior)
7. [Why Binding Is NOT Between Frontend & Database](#7-why-binding-is-not-between-frontend--database)
8. [Validation Process Before Extraction](#8-validation-process-before-extraction)
9. [Testing & Functional Parity Validation](#9-testing--functional-parity-validation)
10. [Binding Layer Ownership & Responsibilities](#10-binding-layer-ownership--responsibilities)
11. [Conclusion](#11-conclusion)

---

## 1. Background & Objective

### What is the Binding Layer?

The **Binding Layer** is a dedicated Python package (`binding/`) extracted from the `modalgateway-Tops-1` backend. It contains all infrastructure coordination code — database client initialization, context-variable-based multi-tenant switching, Pydantic data transfer object (DTO) contracts, and stateless utility libraries (RAG utilities, file parsers).

It is intentionally a **passive library**: it contains no HTTP handlers, no FastAPI routes, no business logic, and no domain reasoning. It does not boot itself. It is imported and initialized by the host application (`unified_server.py`).

### Why Was It Introduced?

Prior to extraction, `unified_server.py` contained everything:
- Business logic (RBAC checks, intent classification, response synthesis)
- Database client definitions and ContextVar switching
- API client initialization (OpenAI, Together AI)
- Pydantic DTOs
- RAG utility functions (embedding, chunking, file parsing)

This **mixed infrastructure and domain logic** created several compounding problems:

| Problem | Impact |
|---|---|
| No infrastructure boundary | Any code change touched DB logic too |
| DB client scattered inline | Context switching was fragile and ad-hoc |
| No formal DTO contract | Frontend/backend interface was implicit |
| RAG utilities inlined | Hard to reuse or test independently |
| Multi-tenant logic embedded | Adding Cohort risked breaking TalentOps flows |

### What Problem It Solves

The binding layer solves the **separation of concerns** problem. By isolating all infrastructure coordination, it:

- Creates a stable, testable boundary between infrastructure and domain code
- Centralizes multi-tenant DB routing in a single, predictable place
- Exposes formal DTO contracts that both the frontend and backend must honor
- Makes the system extensible — adding a new app (e.g., Cohort) requires only updating `binding/database.py`, not modifying business logic

### Why We Are Not Redesigning Domain Logic

This extraction was performed under a strict **"no domain change"** constraint. The chatbot's RBAC rules, intent classification prompts, action registry, and response synthesis logic were not touched. The goal was to extract **coordination code only** — to create the infrastructure layer without changing any observable runtime behavior.

### Why Binding Is Passive

A passive library does not self-initialize. It does not connect to the database on import. It does not read environment variables. It exposes functions (`init_db`, `init_rag`, `select_client`) that the host application calls explicitly, in the correct order, at startup. This design prevents startup-order bugs and ensures the binding layer never has hidden side effects.

---

## 2. Clarification & Question Resolution Log

This section documents the architectural questions that arose during the design and extraction process, along with the final decision reached for each.

---

### Q1: Why should binding live in `modalgateway-Tops-1`?

**Question Asked:** Should the binding layer be a shared package, or should it live inside the gateway project itself?

**Clarification:** The binding layer coordinates the communication flow that *originates from* the model gateway. Its only consumers are the gateway's routes and handlers. No other system (frontend, Supabase) needs to import it.

**Final Decision:** Binding lives at `modalgateway-Tops-1/binding/`. It is a local package within the gateway project. If future requirements demand sharing across multiple services, it can be promoted to a PyPI-installable package with no structural changes.

---

### Q2: Why should binding NOT live in the frontend?

**Question Asked:** Could the frontend use the binding layer to communicate with Supabase, bypassing the gateway?

**Clarification:** The frontend is a React/TypeScript application running in a browser. It cannot run Python. The frontend communicates with Supabase using the official JavaScript Supabase Client via its own `.env` configuration. This is a deliberate, pre-existing architectural choice and is out of scope.

**Final Decision:** Binding is strictly a backend (Python/FastAPI) construct. The frontend does not reference it in any way.

---

### Q3: Why should binding NOT live directly in the database layer?

**Question Asked:** Should we create a separate microservice that sits between the gateway and Supabase?

**Clarification:** Creating a dedicated database-proxy microservice would introduce network overhead, a new failure point, and deployment complexity — all for a system where the gateway is the only DB consumer. The binding layer achieves the same structural clarity without the operational cost.

**Final Decision:** Binding is a within-process library, not a network service. It is co-located with `unified_server.py` and communicates with Supabase via direct HTTPS REST calls, exactly as before.

---

### Q4: Should binding sit as a middle layer between ALL layers?

**Question Asked:** Should ALL traffic — frontend → binding → gateway → Supabase — flow through the binding layer?

**Clarification:** This model is appropriate for backend-to-database communication where the gateway is the originator. Frontend-to-Supabase direct calls (for auth, profile reads in React) are a separate flow that the binding layer is not designed to intercept.

**Final Decision:** Binding intercepts only the gateway ↔ Supabase flow. It does not intercept frontend calls.

---

### Q5: What happens if `modelgateway` is removed?

**Question Asked:** If the model gateway is deprecated, what happens to the binding layer?

**Clarification:** The binding layer is entirely dependent on the gateway for its lifecycle. It has no independent process. If the gateway is removed, the binding layer is also removed. It has no standalone value outside its host.

**Final Decision:** Binding lifecycle is tied to the gateway. It does not need a separate decommission plan.

---

### Q6: Whether Cohort needs its own binding layer?

**Question Asked:** Should the Cohort app (a separate multi-tenant context) have its own binding folder?

**Clarification:** The existing `binding/database.py` already supports Cohort via a conditional initialization path (`cohort_supabase`). The `select_client(app_name)` function routes to the correct client at runtime. No structural duplication is required.

**Final Decision:** A single `binding/` folder serves both TalentOps and Cohort. Cohort is a runtime context, not a structural fork.

---

### Q7: Does environment loading belong in binding?

**Question Asked:** Should `binding/__init__.py` or `binding/database.py` call `load_dotenv()`?

**Clarification:** Environment loading is a startup lifecycle concern, not an infrastructure concern. A passive library must not call `load_dotenv()` because it cannot guarantee when it is imported relative to the host's startup sequence.

**Final Decision:** `load_dotenv()` remains in `unified_server.py`, called at the very top before any imports that depend on environment variables. Binding reads its configuration from arguments passed to `init_db()` and `init_rag()`.

---

### Q8: Does API client initialization belong in binding?

**Question Asked:** Should `OpenAI(...)` and `Together(...)` client instantiation move into binding?

**Clarification:** API clients carry keys and are lifecycle-tied to the application process. Centralized initialization in `unified_server.py` (after `.env` is loaded) is cleaner and more predictable. The `init_rag(client)` call lets the host pass the initialized client into binding, making binding free of direct key dependencies.

**Final Decision:** API clients are initialized in `unified_server.py`. Binding receives them via explicit injection functions (`init_rag`).

---

### Q9: What does "passive library mode" mean?

**Question Asked:** How is the binding layer "passive" if it manages a global `supabase` proxy?

**Clarification:** The `supabase` global in `binding/database.py` is a `SupabaseProxy` object — a Python class that dynamically dispatches attribute access to the client stored in the current `ContextVar`. It holds no connection itself. It only becomes active after `init_db()` is called from the host. Before `init_db()` is called, accessing `supabase.table(...)` raises a `RuntimeError`.

**Final Decision:** Passive means: binding does not self-initialize, does not read env vars, does not establish connections on import. All of these are triggered by the host.

---

### Q10: Circular import risk?

**Question Asked:** Could importing `binding` in `unified_server.py` create a circular import if binding imports from the server?

**Clarification:** Binding has zero imports from `unified_server.py`. Its dependencies are exclusively the Python standard library (`contextvars`, `logging`, `io`, `requests`) and third-party packages (`pydantic`, `PyPDF2`, `python-docx`). The import graph is strictly one-directional.

**Final Decision:** No circular import risk exists. Confirmed via code analysis.

---

### Q11: Startup order risk?

**Question Asked:** Could `unified_server.py` attempt to use `supabase` before `init_db()` is called?

**Clarification:** All usages of `supabase` are inside request handler functions (`slm_chat`, `fetch_user_context`, etc.) that are called only after the server is running. `init_db()` is called at module-level startup, before `app = FastAPI()` completes. The ASGI lifecycle guarantees that no request is handled before the module finishes loading.

**Final Decision:** Startup order is safe. `init_db()` is guaranteed to execute before any request handler accesses `supabase`.

---

### Q12: Does Cohort activation break anything?

**Question Asked:** If Cohort environment variables are provided, could Cohort initialization break TalentOps?

**Clarification:** `init_db()` initializes Cohort only if `cohort_url` and `cohort_key` are both non-None. If either is absent, `cohort_supabase` is set to `None` and Cohort requests return a structured error response. TalentOps initialization is unconditional and is not affected.

**Final Decision:** Cohort activation is safe and additive. It cannot break existing TalentOps flows.

---

## 3. Architecture Before Extraction

### Infrastructure Structure (Before)

Before the binding layer was created, all infrastructure, coordination, and domain code lived inside a single file: `unified_server.py`. There was no formal boundary.

**What lived inside `unified_server.py` without separation:**

| Concern | What It Was | Location |
|---|---|---|
| DB Client | `requests`-based Supabase wrapper class | Inline at module level |
| ContextVar | `current_supabase_client` ContextVar | Inline at module level |
| Client Selection | `select_client()` function | Inline at module level |
| DTO Models | Pydantic request/response classes | Inline at module level |
| RAG Utilities | `chunk_text`, `get_embeddings`, `parse_file_from_url` | Inline at module level |
| Business Logic | Intent classification, RBAC, response synthesis | Inline in request handlers |
| API Clients | OpenAI, Together initialized at module top | Inline at module level |
| HTTP Routes | FastAPI app, all endpoints | Inline |

### Diagram 1 — BEFORE Extraction

```
┌─────────────────────────────────────────────┐
│                  FRONTEND                   │
│          (React / TypeScript / Vite)        │
│    - Auth via Supabase JS Client            │
│    - Chatbot via HTTP → ModelGateway        │
└──────────────┬──────────────────────────────┘
               │ HTTP POST /api/chatbot/query
               ▼
┌─────────────────────────────────────────────────────────────┐
│           unified_server.py  (EVERYTHING MIXED)             │
│                                                             │
│   ┌─────────────────┐   ┌──────────────────────────────┐   │
│   │  INFRASTRUCTURE  │   │       BUSINESS LOGIC         │   │
│   │                  │   │                              │   │
│   │ SimpleSupabase   │   │ slm_chat() handler           │   │
│   │ Client class     │   │ Intent classification        │   │
│   │                  │   │ RBAC check_permission()      │   │
│   │ ContextVar       │   │ Response synthesis           │   │
│   │ (inline)         │   │ Action handlers              │   │
│   │                  │   │                              │   │
│   │ select_client()  │   │ ACTION_REGISTRY              │   │
│   │                  │   │ RBAC_RULES                   │   │
│   │ Pydantic DTOs    │   │ LLM Prompts                  │   │
│   │                  │   │                              │   │
│   │ chunk_text()     │   │ Orchestrator routing         │   │
│   │ get_embeddings() │   │ RAG pipeline                 │   │
│   │ parse_file()     │   │                              │   │
│   └─────────────────┘   └──────────────────────────────┘   │
│                          ⚠ NO CLEAR BOUNDARY ⚠              │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST API
                               ▼
                    ┌──────────────────┐
                    │    Supabase      │
                    │  (PostgreSQL)    │
                    └──────────────────┘
```

---

## 4. Architecture After Extraction

### Binding Folder Structure

```
modalgateway-Tops-1/
├── binding/
│   ├── __init__.py        ← Public API of binding package
│   ├── database.py        ← DB client, ContextVar, select_client()
│   ├── models.py          ← Pydantic DTO contracts
│   └── utils.py           ← Stateless RAG utilities
│
├── unified_server.py      ← Business logic + lifecycle owner
├── rbac_rules.py          ← RBAC + Action Registry (domain, NOT moved)
└── .env                   ← Environment variables (not in binding)
```

### What Each File Contains

**`binding/__init__.py`**  
Exposes the public surface of the package. Re-exports all classes and functions that `unified_server.py` needs to import.

```python
from .models import (SLMQueryRequest, SLMQueryResponse, LLMQueryRequest,
                     LLMQueryResponse, OrchestratorRequest, RAGIngestRequest, RAGQueryRequest)
from .database import (supabase, init_db, select_client, SimpleSupabaseClient, SimpleSupabaseQuery)
from .utils import (init_rag, chunk_text, get_embeddings, parse_file_from_url)
```

**`binding/database.py`**  
Contains: `SimpleSupabaseClient`, `SimpleSupabaseQuery`, `SupabaseProxy`, the `supabase` singleton, `init_db()`, `select_client()`, and the `ContextVar` (`current_supabase_client`).

**`binding/models.py`**  
Contains all Pydantic models: `SLMQueryRequest`, `SLMQueryResponse`, `LLMQueryRequest`, `LLMQueryResponse`, `OrchestratorRequest`, `RAGIngestRequest`, `RAGQueryRequest`.

**`binding/utils.py`**  
Contains: `init_rag()`, `chunk_text()`, `get_embeddings()`, `parse_file_from_url()`.

### How `unified_server.py` Changed

```python
# BEFORE: Inline definitions everywhere

class SimpleSupabaseClient: ...       # Was here
class SLMQueryRequest(BaseModel): ... # Was here
def chunk_text(...): ...               # Was here

# AFTER: Single clean import block

from binding import (
    supabase, select_client, init_db, init_rag,
    SLMQueryRequest, SLMQueryResponse, ...
    chunk_text, get_embeddings, parse_file_from_url
)

# Explicit initialization at startup
init_db(TALENTOPS_SUPABASE_URL, TALENTOPS_SERVICE_ROLE_KEY,
        COHORT_SUPABASE_URL, COHORT_SERVICE_ROLE_KEY)
init_rag(openai_client)
```

### Diagram 2 — AFTER Extraction

```
┌─────────────────────────────────────────────┐
│                  FRONTEND                   │
│          (React / TypeScript / Vite)        │
│    - Auth via Supabase JS Client (direct)   │
│    - Chatbot via HTTP → ModelGateway        │
└──────────────┬──────────────────────────────┘
               │ HTTP POST /api/chatbot/query
               ▼
┌─────────────────────────────────────────────────────────────┐
│           unified_server.py  (Business Logic Only)          │
│                                                             │
│   FastAPI app, routes, lifecycle, RBAC, intent, prompts     │
│   slm_chat(), orchestrate_query(), fetch_user_context()     │
│   ACTION_REGISTRY (from rbac_rules.py)                      │
│                                                             │
│   Startup:  init_db(...)  ← explicit call                   │
│             init_rag(...) ← explicit call                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Python import (in-process)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                binding/  (Infrastructure Only)              │
│                                                             │
│  ┌─────────────────┐  ┌────────────┐  ┌──────────────────┐ │
│  │  database.py    │  │ models.py  │  │    utils.py      │ │
│  │                 │  │            │  │                  │ │
│  │ SimpleSupabase  │  │ Pydantic   │  │ chunk_text()     │ │
│  │ Client          │  │ DTOs       │  │ get_embeddings() │ │
│  │                 │  │            │  │ parse_file()     │ │
│  │ SupabaseProxy   │  │ Request /  │  │ init_rag()       │ │
│  │ (supabase obj)  │  │ Response   │  │                  │ │
│  │                 │  │ models     │  │                  │ │
│  │ ContextVar      │  │            │  │                  │ │
│  │ select_client() │  │            │  │                  │ │
│  │ init_db()       │  │            │  │                  │ │
│  └────────┬────────┘  └────────────┘  └──────────────────┘ │
│           │ HTTPS REST                                      │
└───────────┼─────────────────────────────────────────────────┘
            ▼
┌──────────────────┐
│    Supabase      │
│  (PostgreSQL)    │
│  TalentOps DB    │
│  Cohort DB       │
└──────────────────┘
```

---

## 5. Files & Code Extracted

### What Was Extracted Into Binding

| Component | From (Before) | To (After) | Why It Belongs in Binding |
|---|---|---|---|
| `SimpleSupabaseClient` | Inline in `unified_server.py` | `binding/database.py` | Infrastructure concern — transports HTTP requests to Supabase |
| `SimpleSupabaseQuery` | Inline in `unified_server.py` | `binding/database.py` | Query builder — pure infrastructure, no domain knowledge |
| `SupabaseProxy` | Inline in `unified_server.py` | `binding/database.py` | Dynamically proxies to the correct DB client per request context |
| `current_supabase_client` (ContextVar) | Inline in `unified_server.py` | `binding/database.py` | Context isolation state belongs with the DB coordination layer |
| `select_client()` | Inline in `unified_server.py` | `binding/database.py` | Routing decision for multi-tenant DB access — pure infrastructure |
| `init_db()` | Not formalized | `binding/database.py` | Explicit startup contract replaces scattered inline initialization |
| `SLMQueryRequest` | Inline in `unified_server.py` | `binding/models.py` | DTO — defines the formal contract of the chatbot API |
| `SLMQueryResponse` | Inline in `unified_server.py` | `binding/models.py` | DTO — defines the formal response contract |
| All other Pydantic models | Inline | `binding/models.py` | DTOs belong with the coordination boundary |
| `chunk_text()` | Inline | `binding/utils.py` | Stateless utility — no domain knowledge, reusable |
| `get_embeddings()` | Inline | `binding/utils.py` | Stateless embedding wrapper — infrastructure |
| `parse_file_from_url()` | Inline | `binding/utils.py` | Stateless file parser — infrastructure |
| `init_rag()` | Not formalized | `binding/utils.py` | Explicit injection of the OpenAI client into the RAG utilities |

### What Was NOT Moved (And Why)

| Component | Remains In | Why It Was NOT Extracted |
|---|---|---|
| `slm_chat()` | `unified_server.py` | Core business logic — intent classification, RBAC enforcement, response synthesis. Domain code does not belong in infrastructure. |
| `orchestrate_query()` | `unified_server.py` | Routing intelligence is domain logic — it makes decisions about which AI system to invoke based on query semantics. |
| `ACTION_REGISTRY` | `rbac_rules.py` | Defines what actions the AI can take — this is domain-level knowledge, not infrastructure coordination. |
| `RBAC_RULES` | `rbac_rules.py` | Access control rules are a security policy concern, not an infrastructure concern. |
| LLM System Prompts | `unified_server.py` | Prompts encode domain intent and behavioral rules — entirely domain logic. |
| `fetch_user_context()` | `unified_server.py` | Combines DB access with domain-specific context assembly logic. The DB call uses binding, but the business combination belongs in the server. |
| API Client initialization | `unified_server.py` | OpenAI and Together clients are passed into binding, not owned by it. |

---

## 6. Before vs After Application Behavior

### Database Calls

| Aspect | Before Extraction | After Extraction |
|---|---|---|
| `supabase.table(...)` call | Resolved to an inline class instance | Resolved identically through `SupabaseProxy` → `ContextVar` → same class instance |
| `select_client("talentops")` | Inline function call | Same function, same behavior, from `binding/database.py` |
| Error format on failure | Same `logger.error` pattern | Identical — no change |
| Response structure | `.data`, `.error`, `.status_code` | Identical — no change to the query result object |

### ContextVar Switching

The `ContextVar` (`current_supabase_client`) now lives in `binding/database.py` instead of `unified_server.py`. Functionally, behavior is identical:

1. Request arrives at FastAPI handler
2. `slm_chat()` calls `select_client(app_name)` → sets `ContextVar` to correct DB client
3. All subsequent `supabase.table(...)` calls within that request use the correct client
4. Next request gets its own `ContextVar` scope — isolation is preserved

**No concurrency behavior changed. No isolation changed.**

### API Clients

OpenAI and Together clients are initialized in `unified_server.py` before `init_rag()` is called. The `init_rag(openai_client)` call stores the client in `binding/utils.py`'s module-level `openai_client` variable. Embedding calls from binding use this exact same client object.

### Response Structure

No response contract changed. The `SLMQueryResponse(response=..., action=..., data=...)` Pydantic model is the same model, now imported from `binding/models.py`. The JSON shape emitted by the API is byte-for-byte identical.

### RBAC Behavior

RBAC was not touched. `check_permission()` and `ACTION_REGISTRY` remain in `rbac_rules.py`. The binding layer has no knowledge of RBAC and enforces no access control of its own.

### Cohort Behavior

`select_client("cohort")` now sets the ContextVar to `cohort_supabase`. If Cohort is not initialized (credentials missing), a structured `COHORT_UNAVAILABLE` error is returned. This behavior existed before and was not changed.

---

## 7. Why Binding Is NOT Between Frontend & Database

### Frontend Supabase Access Is Direct

The TalentOps frontend (React/TypeScript) uses the official Supabase JavaScript Client configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from its own `.env` file. This connection is direct, browser-to-Supabase, and uses Row-Level Security (RLS) for access control.

```
Frontend → Supabase JS Client → Supabase (RLS enforced)
```

This is a separate, intentional architecture that predates the binding layer and handles authentication flows, real-time subscriptions (e.g., notifications via Supabase Realtime), and profile reads that do not require the gateway to be involved.

### Binding Does Not Intercept Frontend Calls

The Python `binding/` package runs inside the backend process (`unified_server.py`). It has no browser presence. It cannot intercept HTTP calls made by the frontend's JavaScript. It is structurally impossible for it to sit "between" the frontend and Supabase.

### Why This Is Acceptable

The binding layer's purpose is to coordinate the **model gateway's** access to the database — specifically for AI-driven operations: fetching user context, retrieving notifications, querying leave records, etc. These are **server-side, privileged operations** that use the Service Role Key and bypass RLS.

Frontend direct access (using the Anon Key, RLS-enforced) is a different access tier with different security properties. They are complementary, not redundant.

### Why Rewriting Frontend Access through Binding Is Out of Scope

Routing frontend DB calls through the model gateway would mean every real-time subscription, auth check, and profile read would become an HTTP call to the Python backend — introducing latency, increasing backend load, and eliminating Supabase's native RLS enforcement. The cost-to-benefit ratio is entirely negative for the current system scale.

---

## 8. Validation Process Before Extraction

### Risk Audit Performed

Before extraction began, the following risk checklist was validated:

| Risk | Check Performed | Outcome |
|---|---|---|
| Circular import | Traced all import paths — `binding` imports no server code | ✅ No circular imports |
| Startup order | Verified `init_db()` runs before FastAPI accepts requests | ✅ Safe startup order |
| ContextVar isolation | Confirmed per-request isolation via asyncio context semantics | ✅ Requests isolated |
| Cohort safety | Verified Cohort init is guarded and non-breaking if missing | ✅ TalentOps unaffected |
| Response contract change | Compared `SLMQueryResponse` before and after | ✅ Identical JSON output |
| RBAC change | Confirmed `check_permission()` and `ACTION_REGISTRY` untouched | ✅ No change |
| Runtime behavior change | Compared supabase query resolution path before and after | ✅ Identical resolution |
| Passive library constraint | Verified binding has no `load_dotenv()`, no `FastAPI()` | ✅ Fully passive |
| LLM prompt change | Confirmed all prompts remain in `unified_server.py` | ✅ No change |
| RAG pipeline change | Verified `init_rag()` correctly injects client | ✅ Embeddings work |

### Go / No-Go Decision

All checks passed. Extraction was confirmed safe to proceed with the following agreement:

- Extract only infrastructure coordination code
- Do not touch any handler, prompt, RBAC rule, or action registry entry
- Do not change the API contract (no field renaming, no new required fields)
- Verify parity after extraction before deploying

---

## 9. Testing & Functional Parity Validation

### Endpoints Validated After Extraction

| Endpoint | Test Performed | Result |
|---|---|---|
| `POST /api/chatbot/query` | Basic chatbot query ("hello", "show tasks") | ✅ Correct response |
| `POST /api/chatbot/query` | Navigation query ("go to tasks page") | ✅ `navigate_to_module` action returned with correct route |
| `POST /api/chatbot/query` | Data retrieval ("show my notifications") | ✅ `get_notifications` action returned |
| `POST /api/chatbot/query` | Data retrieval ("show my project documents") | ✅ `get_project_documents` returned, documents listed |
| `POST /api/chatbot/query` | Role-based navigation (manager → hiring page) | ✅ Correct role-specific route returned |
| `POST /api/chatbot/query` | Executive analytics navigation | ✅ `/executive-dashboard/analytics` returned |
| `POST /llm/query` | Direct LLM general query | ✅ Response returned |

### Mutation Tests

| Mutation | Test | Result |
|---|---|---|
| `clock_in` | Employee sends "clock me in" | ✅ Action `clock_in` identified and executed |
| `approve_leave` | Manager sends "approve leave for John" | ✅ RBAC confirmed, action triggered |
| `apply_leave` | Employee applies leave | ✅ `apply_leave` identified with correct params |

### RBAC Tests

| Test | Expected | Result |
|---|---|---|
| Employee attempts `approve_leave` | Denied (not in employee RBAC_RULES) | ✅ Denied with appropriate message |
| Manager accesses hiring | Granted (in manager RBAC_RULES) | ✅ Granted |
| Employee requests team analytics | Denied | ✅ Denied |

### ContextVar Isolation Check

Concurrent requests with different `app_name` values (`talentops` and `cohort`) were simulated. Verified that each request's `supabase` proxy resolved to its own client without cross-contamination.

**Result:** ✅ ContextVar isolation confirmed.

### RAG Tests

| Test | Result |
|---|---|
| `@document-tag` query routes to RAG | ✅ Correct |
| Embedding generation via binding/utils | ✅ `init_rag(openai_client)` correctly injects client |
| PDF file parsing via `parse_file_from_url` | ✅ Correct |

---

## 10. Binding Layer Ownership & Responsibilities

### Role: Binding Layer Engineer

The Binding Layer Engineer is responsible for maintaining all code within `binding/`. They must enforce the constraint that no domain logic enters this package.

### Core Responsibilities

| Responsibility | Scope |
|---|---|
| Maintain DB coordination logic | `SimpleSupabaseClient`, `SimpleSupabaseQuery`, `SupabaseProxy` |
| Maintain client switching | `select_client()`, ContextVar management |
| Maintain infrastructure utilities | `chunk_text()`, `get_embeddings()`, `parse_file_from_url()` |
| Maintain DTO contracts | All Pydantic models in `binding/models.py` |
| Maintain proxy correctness | Ensure `SupabaseProxy` correctly resolves per-request context |
| Enforce no-domain-logic constraint | Reject any PR that introduces RBAC, prompts, or routing logic into `binding/` |

### Update Decision Table

| Trigger | Action Required |
|---|---|
| DB schema changes (new table, renamed column) | Update query calls in `unified_server.py`; no binding change required unless client class behavior changes |
| New app added (e.g., third tenant) | Add a new client variable and conditional in `binding/database.py` → `init_db()` and `select_client()` |
| New AI API client required | Add a new `init_*()` function to `binding/utils.py` using the same injection pattern as `init_rag()` |
| Environment variable names change | Update `unified_server.py` where `os.getenv()` is called; binding reads from passed arguments, not env vars directly |
| New DTO field needed | Add to the appropriate Pydantic model in `binding/models.py`; ensure it is `Optional` to avoid breaking existing clients |
| New route/endpoint added | No binding change required; add handler to `unified_server.py` and use existing binding imports |

### Team Dependencies

**What Binding Depends On:**

| Team | Dependency |
|---|---|
| Backend / Domain Team | Provides `unified_server.py` calling `init_db()` and `init_rag()` correctly |
| Database Team | Supabase schema and REST API contract (table names, column names) |
| DevOps / Config | Correct environment variables provisioned in `.env` |

**What Other Teams Expect From Binding:**

| Team | Expectation |
|---|---|
| Backend / Domain Team | Stable `supabase` proxy that resolves correctly per request; consistent DTO contracts; no domain side effects |
| Frontend Team | Stable JSON response shapes (`action`, `response`, `data` fields in `SLMQueryResponse`) |
| Database Team | Well-formed REST queries using valid table and column names |

---

## 11. Conclusion

The binding layer extraction for the TalentOps ModelGateway has been completed successfully. The following outcomes have been achieved:

### What Was Accomplished

1. **Clear Infrastructure Boundary**: All database coordination, ContextVar switching, DTO definitions, and utility functions have been moved to `binding/`. The `unified_server.py` is now focused exclusively on domain logic.

2. **Formal DTO Contract**: The Pydantic models in `binding/models.py` now serve as the official API contract between the frontend chatbot UI and the backend gateway.

3. **Multi-Tenant Safety**: The `select_client()` + `ContextVar` pattern provides safe, per-request database switching between TalentOps and Cohort with zero cross-contamination.

4. **Passive Library Design**: Binding imposes no startup side effects. The host (`unified_server.py`) controls initialization order explicitly via `init_db()` and `init_rag()`.

5. **Parity Confirmed**: All existing endpoints return identical responses. No RBAC rules, prompts, action registries, or response contracts were changed.

6. **Separation of Concerns Achieved**: Domain engineers can modify chatbot behavior, prompts, and RBAC rules in `unified_server.py` and `rbac_rules.py` without touching infrastructure. Binding engineers can update DB clients and DTO contracts without touching domain logic.

7. **Extensibility**: Adding a new tenant application, a new AI client, or a new DTO field now requires a targeted, isolated change in one well-defined location.

### System Status

| Layer | Status |
|---|---|
| Frontend (talentops-ottobon) | ✅ Operational — no changes required |
| ModelGateway (unified_server.py) | ✅ Operational — clean domain-only code |
| Binding Layer (binding/) | ✅ Operational — infrastructure isolated |
| Supabase (TalentOps) | ✅ Connected and functional |
| Supabase (Cohort) | ✅ Conditionally available when credentials provided |

---

*End of Document*

**Document Classification:** Internal Engineering Reference  
**Next Review Date:** Upon any structural change to the binding layer or the addition of a new tenant application.
