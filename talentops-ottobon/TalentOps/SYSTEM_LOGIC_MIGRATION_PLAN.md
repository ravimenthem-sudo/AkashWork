# TalentOps System Logic Migration Plan: Moving to Zero-Knowledge UI

This document identifies all "Frontend Logic" currently residing in the React components and outlines the roadmap to replace them with secure, server-side Supabase RPCs.

---

## 1. Role: Employee (The Individual Contributor)

| Feature | Current Frontend Logic | Proposed RPC Solution |
| :--- | :--- | :--- |
| **Attendance Focus** | Directly updates `current_task` column in `attendance` table. | `update_attendance_focus(task_text)`: Updates only today's active row for `auth.uid()`. |
| **Task Submission** | Validates phase sequence, handles proof placeholders, and updates `status` to 'In Review'. | `submit_task_proof(task_id, proof_link, phase)`: Verifies user is assigned, validates phase sequence, and timestamps submission. |
| **Leave Application** | Calculates weekdays (Mon-Fri), checks balance, and prevents overlaps in JS. | `apply_for_leave(start_date, end_date, reason)`: Performs calendar math, verifies balance, and inserts request on the server. |
| **My Profile** | Updates personal details like phone/avatar directly. | `update_my_profile(updates_jsonb)`: Validates input format and updates `profiles` for `auth.uid()`. |

---

## 2. Role: Manager (The Team Lead)

| Feature | Current Frontend Logic | Proposed RPC Solution |
| :--- | :--- | :--- |
| **Task Access Review** | Fetches request list, updates status, and then manually updates the Task assignee. | `resolve_task_access(request_id, action)`: An atomic transaction that updates the request AND assigns the task in one shot. |
| **Phase Approval** | Logic to determine if a task should move from "Development" to "Testing" or "Completed". | `review_task_phase(task_id, action, feedback)`: Server decides the next status based on the workflow engine, not the UI. |
| **Leave Approval** | Displays balance but doesn't deduct until manager manually performs actions. | `resolve_leave_request(leave_id, action)`: If 'Approve', it updates the status AND automatically deducts days from the employee profile. |
| **Team Performance** | Calculates "Tasks Completed vs Assigned" in JS filters. | `get_team_stats(team_id)`: Returns pre-aggregated JSON with all performance percentages. |

---

## 3. Role: Executive (The System Admin)

| Feature | Current Frontend Logic | Proposed RPC Solution |
| :--- | :--- | :--- |
| **Employee Onboarding**| Calls Edge function -> Updates Profile -> Updates Finance -> Inserts Projects. (Fragmented) | `onboard_employee_v2(data_json)`: A single atomic RPC that creates all related records. If one fails, everything rolls back. |
| **Payroll Generation** | 200+ lines of JS logic for salary split, LOP deductions, and tax calculations. | `generate_payroll_batch(month, year)`: Scans attendance/leaves, performs the math, and creates the entire month's payroll records. |
| **Invoice Numbering**  | JS logic to generate prefix `INV-MONTH-YY` and fetch the last sequence. | `get_next_invoice_number()`: Server-side sequence generator to prevent duplicate numbers. |
| **Invoice Creation**   | Two separate calls for `invoice` and `items`. (Prone to data loss). | `create_invoice_atomic(header_data, items_array)`: Inserts the main invoice and all child items in a single transaction. |
| **Policies/Announcements**| Direct `.update()` to change status. | `archive_system_record(table_name, record_id)`: Unified function to handle soft-deletes/archiving with permission checks. |

---

## 4. Implementation Priority (Roadmap)

### Priority 1: High-Risk Data (The "Must Fix")
1.  **Employee Onboarding**: Move to atomic RPC to stop partial-creation errors.
2.  **Leave Management**: Move the "Weekday Math" to the server to prevent balance manipulation.
3.  **Task Access**: Move to server so users can't assign themselves to tasks without approval.

### Priority 2: Complexity Reduction (The "Cleaner UI")
4.  **Payroll Math**: Move to RPC to remove 5kg of JavaScript from the frontend.
5.  **Invoice Numbering**: Ensure numbers are generated at the moment of save.

### Priority 3: Polish & Security
6.  **Task Focus Update**: Small but important for 100% Zero-Knowledge attendance.
7.  **Archiving Logic**: Standardize how things are deleted across the system.

---

## 5. Global Technical Rules for Developers

1.  **Security Definer**: All RPCs must use `SECURITY DEFINER` to allow internal table access while keeping RLS closed to the public.
2.  **Input Validation**: No RPC should trust the frontend. The server must check if `auth.uid()` has the specific role (Executive/Manager) before acting.
3.  **JSON Returns**: Every RPC must return a consistent format: `{ "success": boolean, "data": object, "error": string }`.
