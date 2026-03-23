# Archive Button Feature — Implementation Plan

## Goal
Add an "Archive" button so any user can archive their own tasks, regardless of their role.

---

## ✅ Changes Made

### 1. AllTasksView.jsx
- Added `Archive` icon import from lucide-react
- Added `handleArchiveTask()` function
- Added "Archived" option in status filter dropdown  
- Added Archive button in task row actions (purple button)

### Archive Button Logic
- **Visible when:** Task is completed OR current user owns the task
- **Hidden when:** Task is already archived
- **Action:** Sets task status to 'archived'

### Who Can See Archived Tasks
- **All roles** can see their own archived tasks
- **Managers/Executives** can filter to see all archived tasks in the project

---

## SQL Queries

See `ARCHIVE_SQL_QUERIES.md` for database commands.

**Minimum required:** None — feature uses existing status column.

**Optional migration:** Move completed tasks to archived:
```sql
UPDATE tasks SET status = 'archived' WHERE status = 'completed';
```

---

## Time Spent
~15 minutes with Antigravity
