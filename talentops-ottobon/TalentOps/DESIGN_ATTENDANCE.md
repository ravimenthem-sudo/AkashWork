# Attendance & Leave Management: Design Document

## 1. Executive Summary
This module manages employee check-ins, attendance logs, leave requests, and leave balances. It is **Server-Authoritative** to prevent time fraud and ensure leave policies are strictly enforced.

## 2. Core Features

### A. Employee Actions
*   **Check-In / Check-Out**: Real-time timestamp logging. Geolocation (optional).
*   **View Logs**: See history of working hours.
*   **Apply for Leave**: Submit request (Sick, Casual, Privilege).
*   **View Balance**: Real-time view of remaining leave days.

### B. Manager/Admin Actions
*   **Approve/Reject Leaves**: One-click action.
*   **View Team Attendance**: Dashboard of who is present/absent.
*   **Edit Logs**: Correction of attendance errors (Audit logged).

## 3. Database Schema

### Table: `attendance_logs`
*   `id`: UUID
*   `user_id`: UUID
*   `date`: Date
*   `check_in`: Timestamp
*   `check_out`: Timestamp
*   `status`: Text ('present', 'absent', 'half_day', 'late')
*   `total_hours`: Interval

### Table: `leave_requests`
*   `id`: UUID
*   `user_id`: UUID
*   `type`: Text ('sick', 'casual', 'earned')
*   `start_date`, `end_date`: Date
*   `reason`: Text
*   `status`: Text ('pending', 'approved', 'rejected')
*   `approver_id`: UUID

### Table: `leave_balances`
*   `user_id`: UUID
*   `year`: Int
*   `sick_remaining`: Int
*   `casual_remaining`: Int
*   `earned_remaining`: Int

## 4. RPC Interface (API)

### 1. `clock_in()` / `clock_out()`
*   **Logic**: Captures Server Time (`NOW()`). NEVER trusts client time. Checks if already checked in to prevent duplicates.

### 2. `get_my_attendance(month, year)`
*   **Logic**: Returns logs for the user. Calculates "Late" status dynamically based on shift start time.

### 3. `apply_leave(type, dates, reason)`
*   **Logic**:
    *   Checks if dates overlap with existing leave.
    *   Checks if sufficient balance exists in `leave_balances`.
    *   Inserts request if valid.

### 4. `approve_leave_request(request_id, status)`
*   **Logic**:
    *   If Approved: deducts from `leave_balances`.
    *   If Rejected: restores balance (if pre-deducted).
    *   Sends notification.

### 5. `get_team_attendance()`
*   **Logic**: Returns today's status for all direct reports.

## 5. Security Model
*   **Time Fraud**: Prevented by using SQL `check_in = NOW()`.
*   **Balance Integrity**: `apply_leave` strictly checks balance before insert.
*   **Access**: Employees can only read their own data. Managers read their Team's data.
