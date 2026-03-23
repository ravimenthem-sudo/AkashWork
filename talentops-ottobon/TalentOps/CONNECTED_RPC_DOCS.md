
# 📘 Comprehensive RPC Documentation: Connected Systems

This document provides an exhaustive technical and logical breakdown of the Remote Procedure Calls (RPCs) currently **active and connected** to the Talent Ops database. These functions constitute the server-side logic layer for the application.

---

## 📢 1. Announcements & Events Module

### `create_announcement_event`
*   **Type**: Write Operation (Transactional)
*   **Access Control**: `SECURITY DEFINER` (Runs with elevated privileges, relies on internal logic for checks).
*   **Parameters**:
    *   `p_title` (text): Headline of the event.
    *   `p_date` (date): Date of the event.
    *   `p_time` (time): Time of the event.
    *   `p_location` (text): Physical location or 'Broadcast'.
    *   `p_message` (text): Detailed body content.
    *   `p_event_for` (text): Visibility scope ('all', 'team', 'employee', 'my_team').
    *   `p_target_teams` (json): Array of Team IDs (if scope is 'team').
    *   `p_target_employees` (json): Array of User IDs (if scope is 'employee').

#### ⚙️ Internal Logic Flow
1.  **Authentication & Context**:
    *   Calls `auth.uid()` to identify the creator.
    *   Fetches the creator's `org_id` and `role` from the `profiles` table.
    *   *Security Check*: Ensures the user belongs to an Organization.
    *   *Authorization*: (Optional commented-out check for 'manager'/'executive' role exists in code).
2.  **Event Insertion**:
    *   Inserts a new record into the `announcements` table.
    *   **Auto-Status**: Compares `p_date` with `CURRENT_DATE`.
        *   If `p_date == CURRENT_DATE`, status is set to `'active'`.
        *   Otherwise, it defaults to `'future'`.
    *   Stores `p_target_teams` and `p_target_employees` as JSONB for efficient querying later.
3.  **Notification Targeting**:
    *   Calculates the list of specific user IDs (`v_target_user_ids`) who should receive a notification.
    *   **Logic Switch**:
        *   **'all'**: Selects ALL profiles in the `org_id` (excluding self).
        *   **'team'**: Selects profiles where `team_id` matches any ID in `p_target_teams`.
        *   **'employee'**: Selects profiles matching the IDs in `p_target_employees`.
4.  **Bulk Notification Dispatch**:
    *   Performs a **Bulk Insert** into the `notifications` table for every targeted user.
    *   Notification type is set to `'announcement'`.
    *   Message format: `"New [Announcement/Event]: [Title]"`.

---

### `get_my_announcements`
*   **Type**: Read Operation (Complex Query)
*   **Access Control**: `SECURITY DEFINER` (Uses `auth.uid()` to enforce RLS-like filtering).
*   **Returns**: JSON Array of announcement objects.

#### ⚙️ Internal Logic Flow
1.  **Context Retrieval**:
    *   Identifies the caller via `auth.uid()`.
    *   Fetches the caller's `org_id` and `team_id` from `profiles`.
2.  **Complex Filtering (The "News Feed" Logic)**:
    *   Queries `announcements` table for items matching `org_id`.
    *   **Visibility Check (OR Condition)**:
        *   Is `event_for` == `'all'`? (Public events)
        *   Is `event_for` == `'team'` AND does the JSON `teams` array contain my `team_id`?
        *   Is `event_for` == `'employee'` AND does the JSON `employees` array contain my `user_id`?
3.  **Dynamic Status Calculation**:
    *   Does **NOT** read the stored `status` column blindly.
    *   Recalculates status on-the-fly (`CASE WHEN event_date > CURRENT_DATE THEN 'future'...`).
    *   *Why?* This ensures that if a future event becomes "today", the user sees it as 'active' immediately without a background cron job needing to update the database row.
4.  **Sorting**:
    *   Primary: `event_date` (Ascending)
    *   Secondary: `event_time` (Ascending)

---

### `update_announcement_status` & `delete_announcement`
*   **Type**: Maintenance Operations
*   **Access Control**: strict Role-Based Access Control (RBAC).

#### ⚙️ Internal Logic Flow
1.  **Role Verification**:
    *   Fetches the caller's role from `profiles`.
    *   *implied check*: Only updates/deletes if the query successfully runs (Row Level Security usually restricts this, or the function has explicit `IF role NOT IN...` checks).
2.  **Execution**:
    *   Performs a direct `UPDATE` or `DELETE` SQL command on the specific ID.
    *   Returns `{ success: true }` if a row was affected, or error if not found.

---

## 💰 2. Payroll Module

### `generate_monthly_payroll`
*   **Type**: Complex Batch Processing (Transaction)
*   **Criticality**: High (Financial Data)
*   **Parameters**: `p_month_str` (e.g. 'Feb 2026'), `p_total_working_days`.

#### ⚙️ Internal Logic Flow
1.  **RBAC Barrier**:
    *   Immediately checks if `auth.uid()` has role `'executive'`, `'manager'`, or `'admin'`.
    *   Rejects unauthorized calls.
2.  **Idempotency Lock**:
    *   Checks `payroll` table: "Have we already generated a report for this Org + Month?"
    *   *Prevention*: Returns error if duplicate execution is attempted.
3.  **The "Payroll Engine" Loop**:
    *   Opens a cursor for **ALL Active Employees** in the Organization.
    *   Joins `profiles` with `employee_finance` to get base salary (`salary_base`, `salary_hra`, etc.).
    *   **Calculations per Employee**:
        *   **Gross Salary**: `Base + HRA + Allowances`.
        *   **Attendance (Mocked)**: Currently assumes `present_days = total_working_days` (Placeholder for future Attendance module integration).
        *   **Loss of Pay (LOP)**: `(Gross / 30) * lop_days`.
        *   **Net Salary**: `Gross - Dedcutions - Professional Tax`.
    *   **Insetion**:
        *   Writes a new row to `payroll` table with calculated values.
        *   Status set to `'generated'`.
4.  **Reporting**:
    *   Returns the total count of processed employees.

### `get_my_payroll_history`
*   **Type**: Secure Read
*   **Target**: Employees

#### ⚙️ Internal Logic Flow
1.  **Security**:
    *   Uses `auth.uid()` to act as a hard filter.
2.  **Query**:
    *   `SELECT * FROM payroll WHERE employee_id = auth.uid()`.
    *   Ordering: Most recent month first.
3.  **Data Shaping**:
    *   Returns the raw financial columns (`basic_salary`, `net_salary`, `status`) formatted as a JSON list.

### `get_org_payroll_history`
*   **Type**: Admin Read
*   **Target**: Executives/HR

#### ⚙️ Internal Logic Flow
1.  **RBAC Check**:
    *   Must be `executive`, `manager`, or `admin`.
2.  **Data Enrichment (JOIN)**:
    *   Unlike the employee view, this **JOINS** `payroll` with `profiles`.
    *   *Why?* To retrieve `full_name` and `email` alongside the salary data, so the admin knows *who* the payslip belongs to.
3.  **Scope**:
    *   Returns all records for the caller's `org_id`.

---

## 👤 3. User Profile Module

### `get_my_profile_details` (Version 3)
*   **Type**: Aggregation Read
*   **Purpose**: Single-call data fetching for the Profile UI.

#### ⚙️ Internal Logic Flow
1.  **Identity Verification**:
    *   Resolves `auth.uid()` to the user's UUID.
2.  **Parallel Data Fetching**:
    *   **Base Profile**: Reads `profiles` table (Name, Role, Location).
    *   **Org Structure**:
        *   Fetches `department_name` from `departments` table (using `department` ID).
        *   Fetches `primary_project` name from `projects` table (using `team_id`).
    *   **Project Assignments**:
        *   Queries `project_members` table.
        *   *Correction applied in V3*: Fixes column name mismatch (`employee_id` vs `user_id`) and text/uuid casting issues.
        *   Aggregates a list of `{ projectName, role }` objects.
    *   **Compensation**:
        *   Fetches sensitive `employee_finance` data (Basic, HRA).
3.  **JSON Construction**:
    *   Combines all these disparate data sources into a single, nested JSON object structure required by the frontend `ProfileSettings` component.

### `update_my_profile` (Version 2)
*   **Type**: Secure User Update

#### ⚙️ Internal Logic Flow
1.  **Validation**:
    *   Checks string length constraints for `phone` (<20 chars) and `location` (<100 chars).
2.  **Selective Update (Safe List)**:
    *   Updates **ONLY** the following columns in `profiles`:
        *   `phone`
        *   `location`
        *   `avatar_url` (Only if a new URL is provided).
    *   *Security*: Ignores any attempts to update `role`, `salary`, or `org_id`.
3.  **Row Locking**:
    *   Updates the row `WHERE id = auth.uid()`, guaranteeing users can only modify their own profile.

