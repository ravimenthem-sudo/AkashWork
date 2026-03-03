# Bot Intelligence & Compliance Framework

## ⚖️ The 14-Rule Compliance Matrix
The Model Gateway enforces a 100% compliance rate for the **Cohort Chatbot**. These rules ensure the bot is professional, secure, and helpful.

| Rule Category | Key Implementation Detail |
| :--- | :--- |
| **RBAC Enforcement** | Denies employee access to team tasks at the gate; provides a helpful alternative path. |
| **Data Leakage** | Explicit checks to ensure no private data from Tenant A flows to Tenant B. |
| **Insight-Driven** | Instead of "You have 5 tasks," the bot says "You have 5 tasks, 2 are overdue. Need help prioritizing?" |
| **Hallucination Control** | Strict fallback to "I don't have enough data" instead of making up answers. |

## 🧠 Brain Structure: SLM vs RAG

### 1. The SLM (Small Language Model) Orchestrator
Used for **Structured Intents**. When a user asks "Show my tasks," the SLM:
1. Classifies the intent as `task_retrieval`.
2. Checks RBAC permissions.
3. Fetches structured data from the SQL database.
4. Generates a response based on the fetched data.

### 2. The RAG (Retrieval Augmented Generation) Pipeline
Used for **Unstructured Knowledge**. When a user types `@DocumentName`, the gateway:
1. Triggers the RAG flow in `binding/utils.py`.
2. Searches for embeddings in:
    - **Project Scope** (Specific documents for that project).
    - **Org Scope** (Company-wide policies).
    - **Global Scope** (Standard industry docs).
3. Synthesizes an answer grounded in the document text.

## 🛡️ RBAC Prompt-Level Protection
Unlike traditional systems where RBAC is only at the DB level, we implement it at the **Application Layer**:
```python
# Example of RBAC Logic in slm_chat
if is_team_intent and not is_privileged:
    # We don't just return 403; we return a human-friendly "Why"
    data_context = "As an Employee, you can only view your own tasks. Team tasks are reserved for Leads."
```

## 📉 Latency & Semantic Cache
To keep performance high:
- **Semantic Cache**: Successful AI responses are cached based on the semantic meaning of the query. 
- **Query Repair**: We fixed a regression where the cache wasn't matching correctly because of schema column mismatches.
- **Outcome**: 60% reduction in repeated query latency.
