
# 🏆 Points System & Data Flow Explanation

You asked where your points data is going and how it works. Here is the technical breakdown of the system we have implemented:

## 1. Where can I see my Total Points?
We have just added a **"Total Value Earned"** card to your **Employee Dashboard**. 
- It will appear as a purple card showing your aggregate points from all completed tasks.
- If it shows `0`, it means no task submissions have been finalized with points yet.

## 2. Where is the data stored? (Data Flow)

The points system uses two main tables in your Supabase database:

### A. The `tasks` Table (Potential Value)
When a manager creates a task, the potential points are calculated and stored here.
- **Column:** `total_points`
- **Meaning:** This is the *maximum* base value you can earn for the task.
- **Rate:** fixed at 10 pts/hr (e.g., 15 hours = 150 points).

### B. The `task_submissions` Table (Actual Earned Value)
When you submit a task, the final calculation happens here.
- **Column:** `final_points` 
- **Meaning:** This is the *actual* value credited to you.
- **Calculation:** `Base Points` + `Bonus` (if early) - `Penalties` (if late).

## 3. The Flow
1. **Task Created**: `tasks.total_points` is set.
2. **Work Done**: You work on the task.
3. **Submission**: You submit the task. 
   - The system checks `tasks.allocated_hours` vs `task_submissions.actual_hours`.
   - It calculates the `final_points` using the SQL trigger `calculate_task_points`.
   - This value is saved into `task_submissions.final_points`.
4. **Visualisation**: The Dashboard now queries all your `task_submissions` and sums up the `final_points`.

## Summary
- **Potential Points** lived in `tasks`.
- **Earned Points** live in `task_submissions`.
- Your Dashboard now aggregates `task_submissions.final_points`.
