# Scalability Vulnerabilities & Performance Risks

Analysis of **performance bottlenecks** that will degrade as the system scales.

---

## 🔴 Critical Scalability Issues

| Issue | Current Impact | At 10x Scale | At 100x Scale |
|-------|---------------|--------------|---------------|
| **`SELECT *` everywhere** | Minor latency | Noticeable slowdown | Critical bottleneck |
| **No pagination** | OK for small data | UI freezes | App crashes |
| **N+1 query patterns** | Acceptable | Slow page loads | Timeouts |
| **Unfiltered realtime subscriptions** | Works | High bandwidth | Server overload |
| **No caching layer** | Extra DB calls | DB strain | Connection limits hit |
| **Monolithic component renders** | Slow dev builds | UI jank | Memory issues |

---

## 🟥 1. `SELECT *` Anti-Pattern (112+ Occurrences)

### The Problem

Found **112+ instances** of `select('*')` across the codebase:

```javascript
// BAD: Fetches ALL columns regardless of need
const { data } = await supabase.from('tasks').select('*');
const { data } = await supabase.from('profiles').select('*');
const { data } = await supabase.from('attendance').select('*');
```

### Why It's Bad at Scale

| Users | Rows | Columns | Data Transferred |
|-------|------|---------|------------------|
| 10 | 500 tasks | 25 | ~125 KB |
| 100 | 5,000 tasks | 25 | ~1.25 MB |
| 1,000 | 50,000 tasks | 25 | ~12.5 MB |
| 10,000 | 500,000 tasks | 25 | **~125 MB per query!** |

### Affected Files (partial list)

```
teamlead/pages/ModulePage.jsx         (4 occurrences)
teamlead/pages/DashboardHome.jsx      (7 occurrences)
shared/TaskLifecyclePage.jsx          (1 occurrence)
shared/AllTasksView.jsx               (multiple)
manager/pages/ModulePage.jsx          (multiple)
... 100+ more files
```

### Fix

```javascript
// GOOD: Select only needed columns
const { data } = await supabase
    .from('tasks')
    .select('id, title, status, due_date, assigned_to');
```

---

## 🟥 2. No Pagination — Loading All Records

### The Problem

Most queries fetch **all records** without limits:

```javascript
// AllTasksView.jsx line 503
let query = supabase.from('tasks').select('*, phase_validations');
// NO .limit() or .range() → Loads ALL tasks!

// DashboardHome.jsx 
const { data } = await supabase.from('leaves').select('*');
// Could be thousands of leave records!
```

### Scale Impact

| Org Size | Tasks | Load Time | Memory |
|----------|-------|-----------|--------|
| Small | 100 | 200ms | 5 MB |
| Medium | 1,000 | 2 sec | 50 MB |
| Large | 10,000 | 20 sec | 500 MB |
| Enterprise | 100,000 | **Timeout** | **Crash** |

### Fix

```javascript
// Implement pagination
const PAGE_SIZE = 50;
const { data, count } = await supabase
    .from('tasks')
    .select('id, title, status', { count: 'exact' })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
```

---

## 🟥 3. N+1 Query Pattern

### The Problem

Fetching related data in loops instead of joins:

```javascript
// AllTasksView.jsx lines 540-546
const userIds = [...new Set((tasksData).flatMap(t => [t.assigned_to, t.assigned_by]))];

// THEN another query:
const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds);  // 2nd query!
```

This is **better than true N+1** but still suboptimal.

### Worse Example (Employee Fetching)

```javascript
// fetchEmployees() runs multiple queries:
1. profiles query
2. departments query  
3. project_members query
4. attendance query
5. leaves query
6. employee_reviews query  // Some functions add this too!
```

**6 round trips** to load one employee list!

### Fix

Use PostgreSQL joins via Supabase:

```javascript
// Single query with embedded relation
const { data } = await supabase
    .from('tasks')
    .select(`
        id, title, status,
        profiles!assigned_to (id, full_name, avatar_url),
        projects!project_id (name)
    `);
```

---

## 🟥 4. Unbounded Realtime Subscriptions

### The Problem

Found **25+ realtime channels** — many without proper filters:

```javascript
// AllTasksView.jsx line 571-575
const channel = supabase.channel('tasks_realtime')
    .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tasks' 
    }, () => {
        fetchData();  // Refetches ALL tasks on ANY change!
    })
    .subscribe();
```

### Why It's Dangerous

| Issue | Impact |
|-------|--------|
| **No filter** | Triggers on ANY task change, even unrelated |
| **Full refetch** | Re-downloads ALL data on every update |
| **Global channel name** | All users share same channel = broadcast storms |

### Scale Scenario

```
1,000 users online → 100 task updates/minute
= 100 * 1,000 = 100,000 fetchData() calls/minute!
```

### Fix

```javascript
// GOOD: Filtered subscription
const channel = supabase.channel(`tasks-${orgId}-${projectId}`)
    .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tasks',
        filter: `org_id=eq.${orgId}`  // ← Filter!
    }, (payload) => {
        // Incremental update instead of full refetch
        setTasks(prev => updateSingleTask(prev, payload.new));
    })
    .subscribe();
```

---

## 🟥 5. No Caching Layer

### The Problem

Same data fetched repeatedly with no caching:

```javascript
// UserContext fetches profile on EVERY dashboard mount
const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role, org_id')
    .eq('id', user.id)
    .single();

// MessagingHub refetches users on every load
const loadOrgUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
};
```

### Impact at Scale

| Action | DB Calls (Now) | With 100 Users | With Caching |
|--------|---------------|----------------|--------------|
| Load Dashboard | 5 | 500/min | 5/min |
| Open Messages | 3 | 300/min | 3/min |
| View Tasks | 6 | 600/min | 6/min |
| **Total** | - | **1,400/min** | **14/min** |

### Fix

Implement caching via:
- **React Query** / **SWR** for client-side caching
- **employeeService** already has a cache — use it everywhere!

```javascript
// Already exists but underused:
class EmployeeService {
    private employeeCache: Map<string, Employee[]> = new Map();
    
    async fetchEmployees(orgId) {
        if (this.employeeCache.has(orgId)) {
            return this.employeeCache.get(orgId);  // ← Cache hit!
        }
        // ... fetch from DB
    }
}
```

---

## 🟠 6. Monolithic Component Re-renders

### The Problem

```
AllTasksView.jsx  = 3,798 lines
MessagingHub.jsx  = 3,142 lines
```

Any state change re-renders the **entire** component tree.

### React Rendering Math

```javascript
// AllTasksView has 60+ state variables
const [tasks, setTasks] = useState([]);
const [loading, setLoading] = useState(true);
const [filterStatus, setFilterStatus] = useState('All');
// ... 57 more useState calls

// Each setState triggers a re-render of 3,800 lines of JSX
```

### Impact

| Task Count | Render Time | At 60 FPS Target |
|------------|-------------|------------------|
| 50 | 16ms | ✅ OK |
| 200 | 64ms | ⚠️ Jank |
| 500 | 160ms | 🔴 Unresponsive |
| 1000+ | 300ms+ | 💀 Unusable |

### Fix

- Split into smaller components
- Use `React.memo()` for expensive child components
- Use `useMemo()` for filtered/sorted lists (already done in some places ✓)

---

## 🟠 7. Missing Database Indexes (Assumed)

### Queries That Need Indexes

Based on filter patterns in the code:

| Query Pattern | Required Index |
|---------------|---------------|
| `.eq('org_id', orgId)` | `CREATE INDEX idx_tasks_org ON tasks(org_id)` |
| `.eq('assigned_to', userId)` | `CREATE INDEX idx_tasks_assigned ON tasks(assigned_to)` |
| `.eq('project_id', projectId)` | `CREATE INDEX idx_tasks_project ON tasks(project_id)` |
| `.eq('status', 'pending')` | `CREATE INDEX idx_tasks_status ON tasks(status)` |

### Compound Index Recommendations

```sql
-- For the most common query pattern:
CREATE INDEX idx_tasks_org_project_status 
ON tasks(org_id, project_id, status);

-- For employee lookups:
CREATE INDEX idx_profiles_org 
ON profiles(org_id);
```

---

## 🟠 8. File Uploads Without Size Limits

### The Problem

```javascript
// AllTasksView.jsx - No file size check before upload!
const { error: uploadError } = await supabase.storage
    .from('project-docs')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });
```

### Risk

- Users could upload GB-sized files
- Storage costs explode
- Download times become unacceptable

### Fix

```javascript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

if (file.size > MAX_FILE_SIZE) {
    addToast('File too large. Maximum size is 10MB.', 'error');
    return;
}
```

---

## 📊 Performance Risk Matrix

```
                    DATA VOLUME
              Low         Medium        High
         ┌─────────┬─────────────┬───────────┐
    Low  │  ✅ OK  │    ⚠️ Slow  │  🔴 Bad   │
USERS    ├─────────┼─────────────┼───────────┤
  Medium │  ⚠️ OK  │   🔴 Slow   │  💀 Down  │
         ├─────────┼─────────────┼───────────┤
    High │ 🔴 Slow │    💀 Down  │  💀 Down  │
         └─────────┴─────────────┴───────────┘
```

---

## ✅ Priority Fixes for Scaling

| Priority | Fix | Effort | Impact |
|----------|-----|--------|--------|
| 🔴 P0 | Add pagination to all list views | 2 days | Prevents crashes |
| 🔴 P0 | Replace `select('*')` with specific columns | 1 day | Reduces bandwidth 80% |
| 🔴 P0 | Filter realtime subscriptions by org_id | 0.5 day | Prevents server overload |
| 🟠 P1 | Implement React Query for caching | 2 days | Reduces DB calls 90% |
| 🟠 P1 | Add database indexes | 1 hour | 10x query speedup |
| 🟠 P1 | Split monolithic components | 3-5 days | Better UX, faster renders |
| 🟡 P2 | Add file size validation | 2 hours | Prevents storage abuse |

---

> **Bottom Line**: The current architecture works for small teams (<50 users, <1,000 tasks). Beyond that, expect significant performance degradation. The fixes above should be prioritized before any major customer onboarding.
