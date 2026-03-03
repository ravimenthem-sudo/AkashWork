# Payroll Module Implementation Plan

## 1. Objective
Migrate the Payroll module from an insecure client-side model to a **Secure, Server-Authoritative** model using Supabase RPCs. This ensures that salary data is never exposed to unauthorized users and calculations are tamper-proof.

## 2. Current State (Risks)
*   **Data Exposure**: `PayrollPage.jsx` fetches `*` from `payroll` table. A modified client could read everyone's salary.
*   **Client-Side Logic**: Though not fully visible in the snippet, reliance on frontend for sensitive data aggregation is risky.
*   **Role Checks**: UI-based role checks (`userRole === 'Executive'`) are easily bypassed.

## 3. The New Architecture (Target)

We will implement **3 Core RPCs** to handle all data interaction.

### RPC 1: `generate_monthly_payroll(p_month, p_year)`
**Role**: Executive / HR Only
**Logic**:
1.  **Permission Check**: Verify `auth.uid()` has 'executive'/'manager' role.
2.  **Idempotency**: Check if payroll for this month/year already exists.
3.  **Fetch Active Employees**: Get all users with `status = 'active'`.
4.  **Calculate Salary**:
    *   Fetch `net_salary` from `salary_details` table (or `profiles` if stored there).
    *   Calculate `lop_days` (Loss of Pay) from `attendance_logs` (Count 'absent').
    *   `final_pay = (net_salary / 30) * (30 - lop_days)`.
5.  **Insert Records**: Bulk insert into `payroll` table.
6.  **Return**: Success stats (e.g., "Generated for 25 employees").

### RPC 2: `get_org_payroll_history(p_org_id)`
**Role**: Executive / HR Only
**Logic**:
1.  **Permission Check**: Verify `auth.uid()` is Exec/Manager AND belongs to `p_org_id`.
2.  **Fetch**: Return all records from `payroll` table joined with `profiles` (name, email).
3.  **Security**: Returns full financial details for management review.

### RPC 3: `get_my_payroll_history()`
**Role**: Employee (Any Authenticated User)
**Logic**:
1.  **Identity**: Get `auth.uid()`.
2.  **Fetch**: Return records from `payroll` table WHERE `employee_id = auth.uid()`.
3.  **Security**: Strict filtering ensuring users ONLY see their own payslips.

## 4. Database Requirements
We need to verify the `payroll` table schema matches our needs.
*   `id` (UUID)
*   `employee_id` (UUID)
*   `org_id` (UUID)
*   `month`, `year` (Int/Text)
*   `basic_salary`, `hra`, `allowances` (Numeric)
*   `deductions`, `professional_tax` (Numeric)
*   `lop_days` (Int)
*   `net_salary` (Numeric)
*   `status` (Text: 'generated', 'paid')

## 5. Migration Steps

### Step 1: Create RPCs (SQL)
*   Write `rpc_payroll_management.sql` containing all 3 functions.
*   Apply to Supabase.

### Step 2: Refactor `PayrollPage.jsx` (Frontend)
*   **Remove**: Direct `supabase.from('payroll').select(...)`
*   **Add**: `supabase.rpc('get_org_payroll_history')` logic.
*   **Update**: "Generate" button calls `rpc('generate_monthly_payroll')`.

### Step 3: Implement Employee Access
*   Create a new view or update `PayrollPage` to handle "Employee View" mode using `get_my_payroll_history`.

## 6. Verification Checklist
*   [ ] Manager can see all records.
*   [ ] Employee logged in sees ONLY their records.
*   [ ] "Generate" button creates correct math (Salary vs Attendance).
*   [ ] Direct table access (`supabase.from('payroll')`) is blocked by RLS (We will add a Policy).
