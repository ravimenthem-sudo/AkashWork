
# 📋 Task Management System: Comprehensive Role-Based Documentation

This document explains the **Task Management Module** in detail, covering the complete lifecycle of a task from creation to completion, broken down by user role.

---

## 🏗️ Core Concept: The "Points & Hours" System
The system is built on a **Performance-Based Economy**.
*   **Time Blocks**: Tasks are broken down into steps.
*   **Step Duration**: A Global setting determines if a step is **2 Hours** or **4 Hours**.
*   **Allocated Hours**: `(Number of Steps) * (Step Duration)`.
*   **Points**: `Allocated Hours * 10`.
    *   *Example*: A 4-step task (4h/step) = 16 Hours = **160 Points**.
*   **Efficiency**:
    *   **Bonus**: Finishing *under* budget adds points.
    *   **Penalty**: Finishing *over* budget deducts points.

---

## 👔 1. The Manager (Assigner) Flow

### A. Objective
To efficiently allocate work to the right people and track team velocity.

### B. Workflow
1.  **Task Creation**:
    *   The Manager opens the "Create Task" modal.
    *   **Phase Breakdown**: Instead of a vague "Do this", they break work into logical **Steps**.
    *   **Duration Setting**: They toggle the global "Step Complexity" (2h vs 4h) based on the project's nature.
    *   *System Action*: Automatically calculates `Total Hours` and `Potential Points` in real-time.

2.  **Smart Assignment**:
    *   **Skill Filtering**: The manager selects a skill tag (e.g., "React").
    *   **Sorting**: The dropdown sorts team members by "Skill Score" (Ascending/Descending) to help balance the load or train juniors.
    *   **Selection**: Can assign to an individual, a sub-team, or even the whole group.

3.  **Monitoring**:
    *   **Kanban Board**: Sees tasks moving from `To Do` -> `In Progress` -> `Review`.
    *   **Overdue Alerts**: Highlights tasks where `Time Elapsed > Allocated Time`.

### C. Key Responsibility
*   Defining clear **Steps** to ensure the "Allocated Hours" are realistic.
*   Reviewing completed tasks to confirm quality before points are awarded.

---

## 🧑‍💻 2. The Employee (Worker) Flow

### A. Objective
To execute tasks efficiently, earn points, and improve their leaderboard ranking.

### B. Workflow
1.  **Task Discovery**:
    *   Logs in and sees individual **"My Tasks"** dashboard.
    *   Tasks are sorted by Priority/Deadline.
    *   **Visual Cue**: Sees "160 Points / 16 Hours" on the card.

2.  **Execution**:
    *   **Start**: Clicks "Start Task" (Timer begins / Status -> `In Progress`).
    *   **Step Check-ins**: Marks individual steps as done (Progress Bar updates).
    *   **Time Tracking**: The system tracks actual wall-clock hours (or manual entry validation).

3.  **Submission**:
    *   Clicks "Submit for Review".
    *   **Input**: Enters "Actual Hours Taken".
    *   *System Action*: Calculates the **Efficiency Score**.
        *   *Scenario A*: Allocated 10h, Took 8h. **+20 Bonus Points**.
        *   *Scenario B*: Allocated 10h, Took 12h. **-20 Penalty Points**.
    *   **Feedback**: Immediate popup showing "You earned 180 Points!".

### C. Key Motivation
*   Gamification: "If I finish this in 3 hours instead of 4, I get a bonus."
*   Transparency: They know exactly how their performance is measured (Points).

---

## 💼 3. The Executive (Observer) Flow

### A. Objective
To measure organizational efficiency and identify top performers vs. bottlenecks.

### B. Workflow
1.  **Global Oversight**:
    *   Views **"All Tasks"** across all projects.
    *   Filters by status (`Blocked`, `Overdue`).

2.  **Performance Analytics (The "Whale" View)**:
    *   **Percentiles**: Implementation of the "Percentile Ranking" logic.
        *   "User A is in the top 90% of point earners this month."
    *   **Velocity**: "Team X completed 5000 points this week."
    *   **Efficiency Ratio**: `Total Actual Hours` / `Total Allocated Hours`. (Are we underestimating or overestimating work?).

### C. Key Insight
*   Identifying "10x Developers" (consistent positive point variance).
*   Identifying "Scope Creep" (consistent negative point variance across a project).

---

## ⚙️ 4. System Logic (The "Brain")

### Database & RPCs
*   **`tasks` Table**: Stores the `step_duration_enum` and `allocated_hours`.
*   **`task_steps` Table**: Stores the granular breakdown.
*   **`calculate_points()` RPC**:
    *   Triggered on accumulation/submission.
    *   Formula: `(Allocated - Actual) * 10 + Base_Points`.
*   **`get_user_percentile()` RPC**:
    *   Aggregates total points per user.
    *   Ranks them dynamically against the Org or Team.

---

## 🚀 Summary Table

| Feature | Manager | Employee | Executive |
| :--- | :--- | :--- | :--- |
| **Creation** | Breaks work into Steps & Hours | N/A | Can overrides/create |
| **View** | Team specific + Quality Review | Own Tasks + Potential Points | Global Stats & Bottlenecks |
| **Action** | Assign, Edit, Approve | Start, Update, Submit | Strategic Re-allocation |
| **Metric** | Team Velocity | Personal Points & Rank | Org Efficiency & ROI |

