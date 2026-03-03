# Payroll & Payslips Module: Design Document

## 1. Executive Summary
The Payroll module automates salary processing, tax calculations, and payslip generation. This is the **Most Critical Security Module**. Access is strictly limited to HR and Executives. Employees have Read-Only access to their own records.

## 2. Core Features

### A. Salary Management (HR)
*   **Structure Definition**: Base, HRA, DA, Allowances.
*   **Process Payroll**: Monthly batch job to calculate payouts based on attendance.
*   **Invoicing**: For contractors/clients.

### B. Employee View
*   **Payslip History**: Downloadable PDF payslips.
*   **Tax Sheet**: View tax deductions (TDS).

## 3. Database Schema

### Table: `salary_structures`
*   `user_id`: UUID
*   `base_salary`: Numeric
*   `allowances`: JSON
*   `deductions`: JSON
*   `net_salary`: Numeric
*   **Security**: RLS = Private.

### Table: `payslips`
*   `id`: UUID
*   `user_id`: UUID
*   `month`, `year`: Int
*   `generated_at`: Timestamp
*   `pdf_url`: Text (Secure Storage Link)
*   `breakdown`: JSON (Base, HRA, Tax, Net)

## 4. RPC Interface (API)

### 1. `generate_payroll_batch(month, year)`
*   **Logic**:
    1.  Fetches all active employees.
    2.  Calculates `payable_days` from `attendance_logs`.
    3.  Calculates `final_amount = (salary / 30) * payable_days`.
    4.  Inserts into `payslips`.
*   **Access**: HR/Exec ONLY.

### 2. `get_my_payslips()`
*   **Logic**: Returns list of payslips for `auth.uid()`.
*   **Security**: Strict filter `user_id = auth.uid()`.

### 3. `get_salary_structure(target_user_id)`
*   **Logic**: Returns salary details.
*   **Access**: User (Own) OR HR (Any).

## 5. Security Model
*   **Strict RLS**: Direct table access to `salary_structures` is DENIED for everyone except Service Role. Logic must go through sensitive RPCs only.
*   **Audit Logging**: Every view of a salary record should be logged in an audit table.
