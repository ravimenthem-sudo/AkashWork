
# 📋 Talent Ops Implementation Plan: Task & Points System Overhaul

This document breaks down the user's requirements into logical, actionable chunks using first-principles thinking. Each chunk handles a specific part of the system flow, ensuring interlinked dependencies are respected.

**Core Concept:** A time-based, point-driven task management system where task value is derived from allocated hours (determined by "steps"), and performance is measured by efficiency (actual vs. allocated time) and relative ranking (percentiles).

---

## 🧩 Chunk 1: Database Schema & Logic Refinement (Foundation)
**Objective:** solidifying the data structure to support steps, dynamic hours, and complex point calculations.

1.  **Task Schema Update:**
    *   Ensure `tasks` table has columns for:
        *   `step_duration_enum`: enum/text ('2h', '4h') to store the duration setting for the task.
        *   `allocated_hours`: auto-calculated sum of steps * duration.
        *   `total_points`: auto-calculated (`allocated_hours` * 10).
    *   Refine `task_steps` relationship (already exists, but needs to be strictly linked to phase).

2.  **Point Calculation Logic (SQL Functions):**
    *   **Rate Standard:** Hardcode/Config global rate = 10 points/hour.
    *   **Efficiency Bonus (Increment):** Logic: If `actual_hours` < `allocated_hours`, bonus = (`allocated_hours` - `actual_hours`) * Rate. (As per "left over hour points will be added").
    *   **Late Penalty (Decrement):** Logic: If `actual_hours` > `allocated_hours`, penalty = (`actual_hours` - `allocated_hours`) * Rate (or a specific penalty rate).
    *   **Final Points:** `Base Points` + `Bonus` - `Penalty`.
    *   *Constraint:* No bonus if submitted exactly at the last hour (logic: `allocated` == `actual`).

---

## 🧩 Chunk 2: Task Assignment Workflow (Manager Frontend)
**Objective:** Implement the "Assigner Flow" with specific filtering and step configuration.

1.  **Assignee Filtering Logic (Smart Sort):**
    *   **Input:** Manager selects a "Skill Tag" (e.g., 'frontend').
    *   **Query:** Fetch project members / org members.
    *   **Sort:** Ascending order by "Skill Score" (Least skilled on top).
    *   **Selection:** Multi-select individual, team, or specific members.
    *   **Roles:**
        *   Manager: Restricted to own team/project.
        *   Exec/Org Admin: Access to everyone.

2.  **Step & Hours Configuration UI:**
    *   **Global Setting:** Toggle "Step Duration": [2 Hours] or [4 Hours].
    *   **Phase & Step Builder:** Manager adds steps to specific phases.
    *   **Real-time Calc:** Display `Total Allocated Hours` = (Count of Steps) * (Selected Duration).
    *   **Real-time Points:** Display `Total Points` = `Total Hours` * 10.

---

## 🧩 Chunk 3: Task Execution & Submission (Employee Frontend)
**Objective:** The "Worker Flow" where time is tracked and points are finalized.

1.  **Task View:**
    *   Show allocated hours and potential points clearly.
    *   Show breakdown of phases and steps.

2.  **Submission Logic:**
    *   Capture `actual_hours` spent.
    *   **Trigger:** On submission, call the Point Calculation Logic (Chunk 1).
    *   **Feedback:** Show "You earned X points (Y base + Z bonus)" immediate feedback.

---

## 🧩 Chunk 4: Performance Analytics (Percentiles)
**Objective:** Relative performance tracking across the organization and team.

1.  **Aggregation Queries (SQL):**
    *   **Weekly Sum:** Sum `final_points` for `task_submissions` in current week.
    *   **Monthly Sum:** Sum `final_points` for `task_submissions` in current month.

2.  **Percentile Calculation Logic:**
    *   **Context 1 (Org Wide):** Compare user's Total Points vs All Users in Org.
    *   **Context 2 (Team/Project Wide):** Compare user's Total Points vs Team Members.
    *   **Formula:** `(Number of people with fewer points / Total people) * 100`.

3.  **Dashboard Display:**
    *   Show "Weekly Percentile" and "Monthly Percentile".
    *   Show "Total Points Earned" / "Total Potential Points" ratio (e.g., 160/220).

---

## 📊 Summary of Data Flow
1.  **Manager** sets `Step Duration` (2h/4h) & adds `Steps`.
2.  **System** calculates `Allocated Hours` & `Total Points`.
3.  **Employee** submits `Actual Hours`.
4.  **System** calculates `Final Points` (Base +/- Time Diff).
5.  **Analytics** aggregates points to calculate `Percentile Rank`.

