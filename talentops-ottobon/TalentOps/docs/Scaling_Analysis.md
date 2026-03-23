# Scaling & Vulnerability Analysis

## 1. Executive Summary
The current architecture contains critical performance bottlenecks that will cause **system-wide failure** under moderate load (100+ concurrent users). The most severe issue is a **global broadcast storm** caused by client-side filtering of real-time events.

## 2. Critical Vulnerabilities

### 2.1 The "Broadcast Storm" (MessagingHub.jsx)
**Severity: Critical**
The application subscribes to the `conversation_indexes` table **without a filter**.

```javascript
// MessagingHub.jsx
const channel = supabase.channel('sidebar-updates')
    .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_indexes' // <--- NO FILTER!
    }, ...)
```

**Impact:**
-   Every time *any* user in *any* organization sends a message, `conversation_indexes` is updated.
-   Supabase Realtime pushes this event to **every connected client**.
-   **Scenario**: 1,000 users online. 10 messages/second system-wide.
-   **Result**: Every user receives 10 events/second. The backend has to push 10 * 1,000 = 10,000 messages/second.
-   **Consequence**: Supabase Realtime quota exhaustion immediately. Client browsers freeze processing irrelevant events.

**Fix:**
-   Client must subscribe only to their own user ID's channel or specific conversation IDs.
-   Alternatively, RLS must filter the realtime stream (Supabase Realtime RLS).

### 2.2 Unbounded Data Fetching (No Pagination)
**Severity: High**
Key services fetch *all* data without `limit()` or pagination.

#### A. Chat History
`getConversationMessages` in `messageService.js`:
```javascript
.select('*').eq('conversation_id', conversationId)
```
-   **Impact**: Opening a team chat with 1 year of history (50k messages) will download ~10-20MB of JSON and crash the browser rendering the list.

#### B. Leaderboards
`getOrganizationRankings` in `rankingService.ts`:
```javascript
// Fetches ALL profiles and ALL assessments
const { data: profiles } = await profileQuery;
const { data: assessments } = await assessmentQuery;
```
-   **Impact**: For an org with 5,000 students, this query becomes slower linearly. Sorting happens in JavaScript (User CPU), not the database.

### 2.3 Client-Side Logic "Heaps"
**Severity: Medium**
`getConversationsByCategory` fetches **all** membership records for a user, then fetches **all** conversation details, then invalid/legacy ones are filtered in JavaScript.
-   **Impact**: As the `conversations` table grows, the dashboard load time increases.
-   **Fix**: Use a Supabase View or RPC function to join and filter at the database level.

## 3. Security Risks at Scale

### 3.1 Broad RLS Policies
The `profiles` table policy allows `select using (true)`.
-   **Risk**: While convenient for development, this allows any authenticated user to scrape the entire user database (names, emails, avatars) of all organizations by simply calling the API manually.

## 4. Recommendations

1.  **Implement Pagination**: Update `getConversationMessages` to accept `limit` and `offset` (or cursor-based pagination).
2.  **Fix Realtime Subscriptions**: Change the sidebar subscription to listen to a user-specific channel (e.g., `user:uid`) and use Database Triggers to push updates to that channel, OR ensure RLS policies apply to Realtime (Supabase config).
3.  **Move Logic to DB**: Create a Postgres View `user_conversations_view` that handles the joining of members, conversations, and indexes. Query that view instead of 3 separate calls.
