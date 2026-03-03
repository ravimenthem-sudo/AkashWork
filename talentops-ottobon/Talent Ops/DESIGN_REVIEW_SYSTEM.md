# User Review & Appraisal Management System: Design Document

## 1. Executive Summary
This module facilitates the performance review cycle within the organization. It is designed to be **Server-Authoritative** using Supabase RPCs, ensuring that sensitive performance data and salary discussions are strictly access-controlled. The system supports self, manager, and executive reviews.

## 2. The Core Workflow (Lifecycle)

A typical review cycle follows this path:

1.  **Initiation (HR/System)**: A review cycle (e.g., "Q1 2026 Performance Review") is created.
2.  **Self-Review (Employee)**:
    *   Employee logs in.
    *   Sees "Pending Self-Review".
    *   Fills out: Achievements, Challenges, Goals.
    *   Submits (Status -> `self_submitted`).
3.  **Manager Assessment (Manager/Team Lead)**:
    *   Manager receives notification.
    *   Reviews Employee's self-assessment.
    *   Adds: Manager Rating (1-5), Private Notes, Public Feedback.
    *   Submits (Status -> `manager_reviewed`).
4.  **Final Approval (Executive/HR)**:
    *   Executive reviews the Manager's rating.
    *   Approves or Adjusts the rating.
    *   Optional: Inputs Salary Hike/Bonus % (Visible only to Exec/HR).
    *   Finalizes the Review (Status -> `completed`).
5.  **Feedback Release**:
    *   Employee can now view the *Public* Feedback and Final Rating (if allowed).

## 3. Role-Based Capabilities

### 🧑‍💻 Employee
*   **View**: My past reviews.
*   **Action**: Submit Self-Review.
*   **Privacy**: Can NEVER see "Private Manager Notes" or "Executive Discussions".

### 👔 Manager / Team Lead
*   **View**: Reviews for *my direct reports* only.
*   **Action**: Rate employees, Write assessments.
*   **Privacy**: Can see Employee's self-review. Cannot see other teams' reviews.

### 💼 Executive / User Management
*   **View**: ALL reviews across the organization.
*   **Action**: Create Review Cycles, Finalize Ratings, calibrated scores.
*   **Privacy**: Full Access.

## 4. Database Schema (Proposed)

We need new tables to support this securely.

### A. `review_cycles`
*   `id` (UUID)
*   `title` (e.g., "Annual 2025")
*   `start_date`, `end_date`
*   `status` ('active', 'archived')

### B. `user_reviews`
*   `id` (UUID)
*   `cycle_id` (FK -> review_cycles)
*   `user_id` (FK -> profiles, The "Subject")
*   `reviewer_id` (FK -> profiles, The Manager)
*   `status` ('pending_self', 'pending_manager', 'pending_approval', 'completed')
*   **Self Section**: `self_achievements` (Text), `self_challenges` (Text)
*   **Manager Section**: `manager_rating` (Int 1-5), `manager_feedback` (Text), `manager_private_notes` (Text - Hidden from Emp)
*   **Executive Section**: `final_rating` (Int), `is_promotable` (Boolean)

## 5. Security Strategy (RPCs)

All logic must be in RPCs to prevent Employees from reading manager notes or editing their own ratings.

### Key RPCs:
1.  **`get_my_reviews`**:
    *   Employee: Returns `self_*` + `manager_feedback` (if released). Filter out private notes.
    *   Manager: Returns full records for their team.
2.  **`submit_self_review`**:
    *   Allows updating `self_*` columns ONLY if status is `pending_self`.
3.  **`submit_manager_review`**:
    *   Allows Manager to update `manager_*` columns. Enforces "Hierarchical Access" (Must be the manager).
4.  **`finalize_review`**:
    *   Executive only. Locks the record.

## 6. UI Implementation Plan
*   **Employee Dashboard**: New "Performance" Tab.
*   **Manager Dashboard**: New "Team Reviews" Section.
*   **Shared Component**: `ReviewForm.jsx` (Dynamic based on status/role).

## 7. Next Steps
1.  Approve Schema.
2.  Create Tables (SQL).
3.  Create RPCs.
4.  Build UI.
