# Infrastructure & Database: The Foundation

## 🗄️ Database Architecture: Supabase + PostgreSQL
The platform relies on Supabase for Auth, Storage, and Real-time data. The core logic is driven by PostgreSQL triggers and functions.

### Core Tables & Relations
- **`profiles`**: Stores user identity, roles, and technical skill scores (stored as JSONB for flexibility).
- **`tasks`**: Tracks work units, allocated hours, and points.
- **`notifications`**: Powers the real-time notification engine.
- **`conversations` / `messages`**: The backbone of the internal messaging system.

## 🩹 The "Great Schema Repair" (March 2026)
We identified and fixed a critical regression that broke the **Semantic Cache** and **RAG Search**.

### Fixes Applied:
1. **Missing SQL Functions**: Re-implemented the `match_queries` function in the Postgres public schema to support vector similarity searches.
2. **Column Alignment**: Standardized the `query_log` and `semantic_cache` tables to ensure column names matched the `SimpleSupabaseClient` expectations.
3. **Data Isolation**: Added project-level filters to ensure that `queries` from Project A never leaked into the cache for Project B.

## 🧩 Multi-Tenancy Strategy: TalentOps vs. Cohort
The platform supports two distinct environments within the same engineering stack.

| Feature | TalentOps Strategy | Cohort Strategy |
| :--- | :--- | :--- |
| **Credentialing** | Permanent Service Role Keys | On-demand context switching |
| **Logic** | Full Workflow suite | Compliance-first, "Safety First" rules |
| **Database** | Shared cluster, RLS isolated | Cross-DB routing via Binding Layer |

## ⚡ Latency Optimization Techniques
- **Wildcard vs. Explicit Selection**: Switched to `SELECT *, rel(table)` for complex joins to avoid "missing column" errors after schema updates.
- **Vector Indexing**: Implemented `HNSW` (Hierarchical Navigable Small World) indexing on embedding columns for sub-100ms RAG retrieval.
- **Connection Handover**: Optimized how the FastAPI server hands off database requests to the async `requests` pool in `binding/database.py`.

## 📦 File Storage & Security
- **Policies**: Implemented strict storage policies (`fix_storage_policies.sql`) to prevent unauthorized access to employee payslips and offer letters.
- **Parsing**: `binding/utils.py` handles secure retrieval and parsing of PDF/DOCX files via temporary signed URLs.
