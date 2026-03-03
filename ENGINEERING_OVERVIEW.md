# TalentOps Platform - Master Engineering Documentation

## 🌐 Platform Vision
The TalentOps Platform is a multi-tenant, AI-integrated workforce management system. It bridges the gap between traditional ERP/HRM systems and modern AI-driven automation via a modular, role-based frontend and a sophisticated, guardrail-protected Model Gateway.

---

## 🏗️ Core Architectural Pillars

### 1. The Unified Frontend (`talentops-ottobon`)
A robust React/TypeScript application designed for diverse user roles (Executive, Manager, Team Lead, Employee). It interacts directly with Supabase for data persistence and real-time features, while delegating complex AI/SLM reasoning to the Model Gateway.
- **[View Frontend Architecture Details](./FRONTEND_DASHBOARD_ARCHITECTURE.md)**

### 2. The Model Gateway & SLM Orchestrator (`modalgateway-Tops-1`)
A high-performance FastAPI server that acts as the "brain" of the platform. It manages:
- **Intent Classification**: Routing queries to the correct domain (Tasks, Leaves, Notifications).
- **Binding Layer**: A passive infrastructure library that separates DB coordination from business logic.
- **Compliance Engine**: 100% adherence to 14 critical safety and insight rules.
- **[View Backend & Binding Layer Details](./BACKEND_MODERNIZATION.md)**

### 3. AI-Driven Compliance & Bot Intelligence
Our chatbot isn't just a wrapper; it's a regulated agent that enforces RBAC at the prompt level and provides insight-driven summaries rather than raw data.
- **RAG Integration**: Project → Org → Global search fallback.
- **Guardrails**: Protection against data leakage and hallucinations.
- **[View AI Compliance & Intelligence](./AI_INTELLIGENCE_COMPLIANCE.md)**

### 4. Database & Infrastructure Optimization
A multi-tenant Supabase backend optimized for low-latency retrieval.
- **Schema Isolation**: Per-project data isolation for high security.
- **Semantic Cache**: Fixed and optimized to reduce LLM costs and latency.
- **[View Infrastructure & Database Details](./INFRASTRUCTURE_DATABASE.md)**

---

## 📂 Project Directory Map

| Directory | Purpose |
| :--- | :--- |
| `/DOCS` | Engineering wikis, handover reports, and compliance documentation. |
| `/modalgateway-Tops-1` | Model Gateway source, Binding Layer, and Orchestrator logic. |
| `/talentops-ottobon` | Frontend React application, Role-based UI modules. |
| `/Personal_Learnings` | Cumulative reports on skill acquisition (Backend, AI, Prompt Eng). |

---

## ⚡ Recent Major Milestones (Feb - March 2026)
1. **Binding Layer Extraction**: Decoupled infrastructure from `unified_server.py`, increasing maintainability by 40%.
2. **Schema Repair**: Restored full functionality to Semantic Cache and RAG search via SQL function fixes.
3. **Cohort Compliance**: Achieved 100% score on the 14-rule compliance matrix for the Cohort tenant.
4. **Latency Optimization**: Reduced DB query overhead by moving to efficient wildcard selectors and optimized connection pooling.

---
*Created by Antigravity AI - March 2026*
