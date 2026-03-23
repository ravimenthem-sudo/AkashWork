# Employee Management Module: Design Document

## 1. Executive Summary
This module handles the core "directory" of the organization. It manages user profiles, roles, employment status, and onboarding/offboarding workflows. It serves as the **Source of Truth** for user identity.

## 2. Core Features

### A. Directory & Profile
*   **Employee Directory**: Searchable list of colleagues.
*   **Profile View**: Professional details, skills, contact info.
*   **Org Hierarchy**: Visual tree of reporting lines.

### B. Onboarding (Admin/HR)
*   **Add Employee**: Create auth user + profile record.
*   **Assign Role**: Set permissions (Manager, Exec, etc.).
*   **Status Management**: Active, Probation, Notice Period, Terminated.

## 3. Database Schema

### Table: `profiles` (Existing)
*   `id`: UUID (matches auth.users)
*   `full_name`, `email`, `phone`, `avatar_url`
*   `role`: Text ('employee', 'manager', 'executive')
*   `team_id`: UUID
*   `manager_id`: UUID (Reports To)
*   `designation`: Text
*   `status`: Text ('active', 'inactive')
*   `joining_date`: Date

### Table: `teams` / `projects`
*   `id`: UUID
*   `name`: Text
*   `lead_id`: UUID

## 4. RPC Interface (API)

### 1. `get_employee_directory()`
*   **Logic**: Returns public profile data (Name, Role, Email) for all active users. Hides sensitive fields (Salary, Personal Phone) unless HR.

### 2. `get_org_hierarchy()`
*   **Logic**: Recursive query to build the "Manager -> Subordinate" tree structure.

### 3. `update_employee_status(user_id, status)`
*   **Secure Action**: Only HR/Exec can call. Can disable login access if status is set to 'Terminated'.

### 4. `update_my_profile()`
*   **Logic**: Allows users to update *safe* fields (Photo, Bio). Prevents them from updating *restricted* fields (Role, Salary, Manager).
*   *(Already implemented)*

## 5. Security Model
*   **Field-Level Security**:
    *   `salary`, `bank_details`: Visible ONLY to User and HR.
    *   `role`, `designation`: Editable ONLY by HR.
*   **Zero-Knowledge Frontend**: The UI just displays what the `get_employee_directory` RPC returns. It doesn't know about hidden columns.
