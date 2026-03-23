# Announcements & Events Module: Design Document

## 1. Executive Summary
The Announcements module serves as the central communication hub. It allows Executives and Managers to broadcast messages or schedule specific events. The system is **Server-Authoritative**, meaning all visibility rules (who sees what) are calculated securely on the backend.

## 2. Core Features

### A. View Announcements (All Roles)
*   **Logic**: Users see a list of announcements/events relevant to them.
*   **Filtering**:
    *   **Broadcasts**: Visible to everyone in the Org.
    *   **Team Events**: Visible only if `user.team_id` matches the event's target team.
    *   **Personal Events**: Visible only to the specific user.
*   **Status**: Automatically calculated as 'Future', 'Active', or 'Completed' based on the date.

### B. Create Announcements (Exec/Manager)
*   **Logic**: Create a record with a specific audience (`event_for`: 'all', 'team', 'employee').
*   **Validation**: Server validates permissions.

### C. Dashboard Integration
*   **Logic**: The "Calendar" widget on the Dashboard reuses the exact same API to show dots for event days.

## 3. Database Schema

### Table: `announcements`
*   `id`: UUID (PK)
*   `org_id`: UUID
*   `title`: Text
*   `message`: Text
*   `event_date`: Date
*   `event_time`: Time
*   `location`: Text
*   `event_for`: Text ('all', 'team', 'employee', 'specific')
*   `teams`: Text[] (Array of Team IDs)
*   `employees`: Text[] (Array of User IDs)
*   `status`: Text ('active', 'cancelled', 'archived')
*   `created_at`: Timestamp

## 4. RPC Interface (API)

All frontend logic has been moved to these 4 RPCs:

### 1. `get_my_announcements()`
*   **Input**: None (Uses `auth.uid()`).
*   **Output**: JSON List of events.
*   **Security**: Filters by Org and Audience. Hides irrelevant events.

### 2. `create_announcement_event()`
*   **Input**: Title, Date, Time, Audience, Targets (JSON).
*   **Logic**: Converts JSON inputs to Postgres Arrays. Inserts record.

### 3. `update_announcement_status()`
*   **Input**: ID, New Status.
*   **Logic**: Updates the status column.

### 4. `delete_announcement()`
*   **Input**: ID.
*   **Logic**: Deletes the record.

## 5. Security Model
*   **RLS**: Table RLS is bypassed by `SECURITY DEFINER` functions to allow complex cross-filtering, but direct table access is restricted.
*   **Frontend**: "Zero Logic". It essentially renders whatever list the `get_` RPC returns.
