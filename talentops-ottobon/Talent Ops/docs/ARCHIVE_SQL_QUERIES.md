# Archive Correction — SQL Queries

Run these in **Supabase SQL Editor** in order.

---

## Step 1: First, check what sub_states exist

```sql
SELECT sub_state, COUNT(*) FROM tasks GROUP BY sub_state;
```

Look at the output. Then run these:

---

## Step 2: Restore completed tasks

```sql
UPDATE tasks 
SET status = 'completed' 
WHERE status = 'archived' 
  AND sub_state IN ('approved', 'completed');
```

---

## Step 3: Restore in-progress tasks back to in_progress

```sql
UPDATE tasks 
SET status = 'in_progress' 
WHERE status = 'archived' 
  AND sub_state = 'in_progress';
```

---

## Step 4: Restore pending validation tasks to pending

```sql
UPDATE tasks 
SET status = 'pending' 
WHERE status = 'archived' 
  AND sub_state = 'pending_validation';
```

---

## Step 5: Keep remaining as archived (pending/on_hold tasks)

Everything still marked 'archived' after Steps 2-4 stays archived.

---

## Step 6: Verify

```sql
SELECT status, COUNT(*) FROM tasks GROUP BY status;
```

---

## Run Order
1. Run Step 1 — share the output if unsure
2. Run Steps 2, 3, 4 in order
3. Run Step 6 to verify
4. Refresh your app
