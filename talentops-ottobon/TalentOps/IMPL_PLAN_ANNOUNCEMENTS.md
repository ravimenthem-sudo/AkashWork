# Implementation Plan: Migrating Announcements to RPC

This plan outlines the steps to refactor the Announcements feature from insecure client-side logic to secure, server-side Remote Procedure Calls (RPCs).

## Phase 1: Create Secure RPCs (Database Layer)

We will create two new SQL functions to handle the "Read" and "Write" operations for announcements.

### 1. `get_my_announcements` (Read-Only)
*   **Purpose**: Fetches announcements visible to the current user.
*   **Logic**:
    *   Gets `auth.uid()`.
    *   Fetches accessible announcements (`event_for = 'all'`, or matches user's `team_id`, or `user_id` in list).
    *   **Crucially**: Calculates `status` ('active', 'future', 'completed') dynamically based on `event_date` vs `NOW()`.
    *   Returns clean JSON array.
*   **File**: `rpc_get_my_announcements.sql`

### 2. `create_announcement` (Write)
*   **Purpose**: Creates an announcement and sends notifications atomically.
*   **Logic**:
    *   Inserts row into `public.announcements`.
    *   Identifies target audience (All vs Team vs Individual).
    *   Bulk inserts rows into `public.notifications` for all recipients.
*   **File**: `rpc_create_announcement.sql`

## Phase 2: Frontend Refactor (React Layer)

We will modify `AnnouncementsPage.jsx` to use these new RPCs.

### 1. Replace Fetch Logic
*   **Role**: Employee, Manager, Executive (All roles use the same component).
*   **Action**:
    *   Remove the `fetchData` function that calls `supabase.from('announcements').select('*')`.
    *   Remove client-side filtering logic (hiding events via JS).
    *   Remove "Auto-Update" logic (the `useEffect` that updates statuses on load).
    *   **Add**: `supabase.rpc('get_my_announcements')`.

### 2. Replace Create Logic
*   **Role**: Manager, Executive.
*   **Action**:
    *   Remove the `handleAddEvent` function that does 2 separate inserts.
    *   **Add**: `supabase.rpc('create_announcement', { ...payload })`.

## Phase 3: Verification & Cleanup

### 1. Verify "Read"
*   **Test**: Log in as Employee.
*   **Check**: Do I see "Broadcast" announcements? Do I see my Team's events?
*   **Check**: Are "future" events hidden or shown correctly?

### 2. Verify "Write"
*   **Test**: Log in as Manager.
*   **Action**: Create a Team Announcement.
*   **Check**: Does it appear immediately? Do team members get a notification?

### 3. Database Cleanup (Optional)
*   Once reliable, we can revoke direct `SELECT/INSERT/UPDATE` permissions on the `announcements` table for non-service-role users, enforcing RPC usage.

## Rollback Plan
If issues arise:
1.  Revert `AnnouncementsPage.jsx` to the previous version (via Git).
2.  The SQL functions can remain in the database (they won't hurt anything if unused).
