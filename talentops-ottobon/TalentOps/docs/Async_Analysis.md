# System Design Analysis: Synchronous vs. Asynchronous Execution

## 1. Executive Summary
This analysis evaluates the "Cohort" codebase to identify blocking operations, race conditions, and architectural bottlenecks caused by improper synchronous/asynchronous patterns. The findings highlight that while some areas utilize parallel execution (e.g., `ManagerTaskDashboard`), critical paths like **Messaging** and **Task State Management** suffer from sequential blocking logic and client-side race conditions.

## 2. Execution Flow & Critical Path Analysis

### 2.1 Messaging System (`messageService.js`)
**Current Flow:**
1.  User clicks "Send".
2.  `sendMessage` (Async) is called.
3.  **[BLOCKING]** DB Insert: Message record created.
4.  **[BLOCKING]** File Uploads: Attachments uploaded **sequentially** (Loop `await`).
5.  **[BLOCKING]** Index Update: Conversation `last_message` updated.
6.  **[BLOCKING]** Notification Generation: Fetches *all* conversation members, then inserts notifications.
7.  Function returns.

**Critique:**
*   **False-Synchronous**: The user interface waits for file uploads and notification generation before confirming the message is "sent".
*   **Latency Risk**: If a user sends 5 images (2s each) to a group of 100 people (notification batch overhead), the "Send" action takes >10 seconds.
*   **Recommendation**:
    *   **Uploads**: Use `Promise.all` for parallel uploads.
    *   **Notifications**: Move to **Database Triggers** or an **Edge Function**. The client should *only* wait for the message insert.

### 2.2 Task Validations (`MyTasksPage.jsx`)
**Current Flow:**
1.  Student uploads proof.
2.  File uploaded to storage.
3.  **[RISKY]** Client calculates `nextPhase` based on *local* state (`taskForProof`).
4.  Client determines `sub_state` (e.g., reset to `pending_validation`).
5.  Client sends `UPDATE` command to DB with new state.

**Critique:**
*   **Race Condition**: The "Next Phase" logic relies on the client's view of the task. If a manager rejects the task *during* the upload process, the client will unknowingly overwrite the rejection with its calculated state (based on stale data).
*   **Leaky Logic**: Business rules for "what is the next phase" are duplicated in the frontend.
*   **Recommendation**:
    *   **Atomic Transitions**: Create a Postgres RPC `submit_task_proof(task_id, proof_url)` that handles the state transition server-side.

### 2.3 Manager Dashboard (`ManagerTaskDashboard.jsx`)
**Current Flow:**
1.  Dashboard Mounts.
2.  `Promise.all` triggers:
    *   `fetchValidationQueue`
    *   `fetchAllTasks`
    *   `fetchExtensionRequests`
3.  `fetchAllTasks`: Fetches tasks -> Extracts IDs -> **[BLOCKING]** Fetches Profiles -> Map names.

**Critique:**
*   **Good**: Uses `Promise.all` to parallelize independent data fetching.
*   **Bad**: The "Fetch Profiles" step is a mental model carryover from non-relational DBs. It performs an in-memory join.
*   **Recommendation**: Use Supabase/Postgres foreign key joins (`select('*, profiles(full_name)')`) to fetch data in a single round-trip.

### 2.4 Organization Rankings (`rankingService.ts`)
**Current Flow:**
1.  Fetch **ALL** profiles.
2.  Fetch **ALL** assessments.
3.  **[BLOCKING]** Calculate scores & Sort in JavaScript.

**Critique:**
*   **Sync Bottleneck**: This purely synchronous CPU-bound operation blocks the main thread (UI freeze) for large datasets.
*   **Recommendation**: Move aggregation to a Postgres View (`organization_rankings`) to offload processing to the database.

## 3. Synchronous vs. Asynchronous Map

| Component | Operation | Current | Ideal | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Messaging** | File Uploads | Sequential `await` | `Promise.all` | Reduces latency by factor of N (files). |
| **Messaging** | Notifications | Sync in `sendMessage` | Async (DB Trigger) | Decouples sending from notification overhead. |
| **Messaging** | Index Update | Sync in `sendMessage` | Async (DB Trigger) | Faster UI response. |
| **Task** | State Transition | Client-Side Logic | Server-Side (RPC) | Prevents race conditions and data inconsistency. |
| **Dashboard** | Data Loading | `Promise.all` | `Promise.all` | **Keep**. (Good pattern). |
| **Ranking** | Score Calc | Client Sync | DB View | Prevents browser freeze on large orgs. |

## 4. Recommendations & Failure Boundaries

### 4.1 Isolate Side Effects
**Issue**: Currently, if notification generation fails (e.g., `notifications` table lock), the `sendMessage` function catches the error but the user might see a delay or inconsistent state.
**Fix**:
*   **Boundary**: The API boundary for `sendMessage` should end after the `messages` table insert.
*   **Mechanism**: Use `pg_net` or Supabase Edge Functions triggered by the `INSERT` on `messages` to handle side effects (notifications, emails, push, index updates).

### 4.2 Optimistic UI vs. Truth (Consistency)
**Issue**: `MyTasksPage` calculates the next state to show the user immediately *and* sends it to the DB.
**Fix**:
*   **Strategy**: Optimistic UI is fine for the *visuals*, but the *logic* must be server-authoritative.
*   **Implementation**: The client should send "I uploaded proof X", not "Set state to Y". The server decides the new state.

### 4.3 Parallelize I/O
**Issue**: `messageService.js` loop:
```javascript
for (const file of files) {
    await uploadAttachment(file, ...); // Waits for each
}
```
**Fix**:
```javascript
await Promise.all(files.map(file => uploadAttachment(file, ...)));
```

## 5. Conclusion
The codebase generally abuses synchronous `await` chains for operations that should be parallel or backgrounded. Transitioning to **Server-Side State Transitions (RPCs)** and **Database Triggers** for side effects will significantly improve perceived performance and data integrity.
