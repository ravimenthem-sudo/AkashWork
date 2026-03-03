# Attendance System Architecture: Server-Authoritative RPC Design

This document details the refactored attendance tracking system, moving from a client-side authoritative model to a secure, server-side Remote Procedure Call (RPC) architecture.

## 1. Architectural Philosophy: "Zero-Knowledge" UI

The primary goal of this refactor was to decouple the frontend from the database schema.

- **Old Way (Vulnerable/Brittle)**: The React components directly queried the `attendance` table, performed date filtering in JS, and calculated total hours locally before sending them to the database.
- **New Way (Secure/Robust)**: The UI acts as a "dumb" remote control. It triggers server-side functions and waits for a success/error response. It has no knowledge of table names like `attendance` or column names like `org_id`.

## 2. Infrastructure: The RPC Layer

The system relies on three core Postgres functions (RPCs) defined in Supabase. These functions use `SECURITY DEFINER` to execute with elevated privileges, allowing for strict RLS (Row Level Security) on the tables themselves.

### A. `check_in()`
- **Responsibility**: Authenticates the session and creates a new attendance record.
- **Key Logic**:
    - Automatically retrieves the user's `org_id` from the `profiles` table using `auth.uid()`.
    - Forces the timezone to **Indian Standard Time (IST/Asia/Kolkata)**.
    - Prevents duplicate check-ins for the same day.
- **Input**: None (Identity is derived from the JWT).

### B. `check_out()`
- **Responsibility**: Closes the active session and calculates work duration.
- **Key Logic**:
    - Finds the current active record for the user.
    - Subtracts `clock_in` from the current time.
    - Converts the duration into a numeric `total_hours` value.
    - Updates the status to `'completed'`.
- **Input**: None.

### C. `get_my_attendance_status()`
- **Responsibility**: Provides the UI with the current session state.
- **Key Logic**:
    - Fetches today's record for the user.
    - Returns a JSON object containing `clock_in`, `clock_out`, and `current_task`.
- **Input**: None.

---

## 3. Data Flow & Routing

### Interactive Flow (Check-In Example)
1. **Trigger**: User clicks the "Check In" button in `AttendanceTracker.jsx`.
2. **Action**: Frontend calls `const { data, error } = await supabase.rpc('check_in')`.
3. **Routing**:
   - The request hits the **Supabase API Gateway**.
   - It is routed to the **PostgREST** layer.
   - PostgREST executes the `public.check_in()` Postgres function.
4. **Database**: The function inserts a row into the `attendance` table.
5. **Response**: The function returns `{ "success": true }` to the frontend.
6. **UI Sync**:
   - The frontend receives the success response.
   - It triggers `fetchAttendance()` (which uses `get_my_attendance_status`).
   - The UI state updates (Buttons change, timer starts).

### Real-Time Sync Flow
1. **Event**: The database record is updated (by the RPC).
2. **Channel**: The Supabase **Realtime service** detects the change in the `attendance` table.
3. **Filter**: The change is filtered by `employee_id` and broadcast to the client.
4. **Update**: The UI listens via `supabase.channel()` and automatically refreshes data in the background if another device checks the user in/out.

---

## 4. Timezone Strategy

To ensure consistency across global servers and local users, the system uses **Forced Timezone Alignment**:

- **Database Storage**: Times are stored as `TIME` or `TIMESTAMP`.
- **Logic**: All time calculations in the RPCs use:
  ```sql
  (now() AT TIME ZONE 'Asia/Kolkata')::time
  ```
- **Result**: Even if the Supabase server is in New York (EST) and the user's laptop is in London (GMT), the work session will always be recorded in **Indian Standard Time (IST)**, ensuring payroll calculations remain consistent.

## 5. Security & Validation

- **No Spoofing**: Since the browser doesn't send the `clock_in` time, users cannot manipulate their start/end times via the browser console.
- **Implicit Identity**: All filters use `auth.uid()`, preventing a user from checking in on behalf of another user by swapping IDs.
- **Integrity**: The `org_id` is looked up server-side, ensuring every record is correctly associated with an organization without relying on frontend state.
