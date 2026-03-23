# Technical Debt Report: Talent Ops Architecture

**Prepared by:** Development Team  
**Date:** February 2026  
**Purpose:** Comprehensive analysis of architectural issues requiring refactoring

---

## Executive Summary

This report documents **six critical architectural issues** in the Talent Ops codebase that impact maintainability, testability, and scalability. Each issue is explained with evidence from the actual codebase, impact analysis, and recommended solutions.

---

## Table of Contents

1. [Massive Monolithic Components](#1-massive-monolithic-components)
2. [Single Responsibility Principle Violations](#2-single-responsibility-principle-violations)
3. [Duplicated UserContext Across Roles](#3-duplicated-usercontext-across-roles)
4. [Database Queries Scattered Across Components](#4-database-queries-scattered-across-components)
5. [Direct Supabase Coupling in UI Components](#5-direct-supabase-coupling-in-ui-components)
6. [Duplicated Core IDs Pattern](#6-duplicated-core-ids-pattern)

---

## 1. Massive Monolithic Components

### What Is This Issue?

Two React components have grown to an **unmaintainable size**, containing thousands of lines of code with over 30+ functions each:

| Component | Lines of Code | Functions | Bytes |
|-----------|--------------|-----------|-------|
| `AllTasksView.jsx` | **3,798** | 34+ | 234 KB |
| `MessagingHub.jsx` | **3,142** | 41+ | 180 KB |

### Evidence From Codebase

**AllTasksView.jsx** contains the following functions in a single file:

```
├── handleRequestAccess()           ├── handleApprovePhase()
├── handleApproveAccess()           ├── handleRejectPhase()
├── handleProcessAccessReview()     ├── openIssueModal()
├── fetchEmployees()                ├── resolveIssue()
├── fetchData()                     ├── getPriorityStyle()
├── handleUpdateTask()              ├── getStatusStyle()
├── handleDeleteTask()              ├── getPhaseIndex()
├── handleDeleteProof()             ├── openProofModal()
├── handleEditTask()                ├── handleFileChange()
├── handleSaveEdit()                ├── handleSubmitProof()
├── handleAddTask() ← 273 lines!    ├── LifecycleProgress (sub-component)
├── downloadCSV()                   ├── normalizeDate()
├── handleApproveTask()             ├── isWithinDateRange()
├── handleRejectTask()              └── ... and more
```

**MessagingHub.jsx** similarly contains:

```
├── PollContent()                   ├── handleSendMessage()
├── handleTextareaChange()          ├── handleReaction()
├── renderMessageContent()          ├── handleFileAttachment()
├── getSenderName()                 ├── removeAttachment()
├── fetchConversationMembers()      ├── handleKeyPress()
├── formatDividerDate()             ├── handlePaste()
├── fetchCurrentUser()              ├── startNewDM()
├── loadOrgUsers()                  ├── startChatWithUser()
├── onMessage()                     ├── createNewTeamChat()
├── onReaction()                    ├── joinOrganizationChat()
├── onPollUpdate()                  ├── toggleTeamMember()
├── scrollToBottom()                ├── handleAddMember()
├── loadConversations()             ├── handleRemoveMember()
├── loadMessages()                  ├── handlePromoteToAdmin()
├── deleteMessageForEveryone()      ├── handleDemoteFromAdmin()
├── deleteMessageForMe()            ├── handleRenameGroup()
├── fetchPollVotes()                ├── handleDeleteGroup()
├── handleSendPoll()                ├── handleLeaveGroup()
├── handleVote()                    └── ... and more
```

### Why This Is A Problem

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROBLEMS WITH MONOLITHIC COMPONENTS          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ❌ TESTING IS NEARLY IMPOSSIBLE                                │
│     • Cannot unit test individual functions in isolation        │
│     • Mocking dependencies requires loading entire component    │
│     • Test files would need to be equally massive               │
│                                                                 │
│  ❌ MAINTENANCE NIGHTMARE                                        │
│     • Finding a specific function takes significant time        │
│     • Scrolling through 3,800 lines to find a bug               │
│     • Understanding data flow requires reading entire file      │
│                                                                 │
│  ❌ TEAM COLLABORATION BLOCKED                                   │
│     • Two developers cannot work on the same file               │
│     • Git merge conflicts are guaranteed                        │
│     • Code reviews become overwhelming                          │
│                                                                 │
│  ❌ PERFORMANCE DEGRADATION                                      │
│     • Entire component re-renders on ANY state change           │
│     • Hot reloading is slow during development                  │
│     • Browser DevTools struggle with large component trees      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Solution

**Split into smaller, focused components:**

```
AllTasksView/
├── index.jsx                    # Orchestrator (~200 lines max)
├── hooks/
│   ├── useTaskData.js           # Data fetching logic
│   ├── useTaskFilters.js        # Filter state management
│   └── useTaskActions.js        # CRUD operations
├── components/
│   ├── TaskTable.jsx            # Table rendering
│   ├── TaskFilters.jsx          # Filter controls
│   ├── TaskRow.jsx              # Individual row
│   ├── AddTaskModal.jsx         # Add task form
│   ├── EditTaskModal.jsx        # Edit task form
│   ├── ProofModal.jsx           # Proof submission
│   ├── IssueModal.jsx           # Issue reporting
│   └── LifecycleProgress.jsx    # Progress indicator
└── services/
    └── taskService.js           # Business logic
```

**Target:** Each file should be **≤300 lines** with a **single responsibility**.

---

## 2. Single Responsibility Principle Violations

### What Is This Issue?

The **Single Responsibility Principle (SRP)** states that a module should have one, and only one, reason to change. Many components in the codebase violate this by handling multiple unrelated responsibilities.

### Evidence From Codebase

**Example: `AllTasksView.jsx` handles 6+ distinct responsibilities:**

| Responsibility | Should Be Separate? |
|---------------|---------------------|
| 1. Fetching task data | ✅ Yes → `useTaskData` hook |
| 2. Fetching employee data | ✅ Yes → `employeeService` |
| 3. Task CRUD operations | ✅ Yes → `taskService` |
| 4. File upload logic | ✅ Yes → `uploadService` |
| 5. Notification sending | ✅ Yes → `notificationService` |
| 6. UI rendering | ✅ Yes → Separate presentation components |

**Visual Representation:**

```
┌────────────────────────────────────────────────────────────────┐
│                     AllTasksView.jsx (CURRENT)                 │
│────────────────────────────────────────────────────────────────│
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ DATA FETCHING        │ BUSINESS LOGIC    │ UI RENDERING  │  │
│  │ • fetchData()        │ • handleApprove() │ • JSX (2000+  │  │
│  │ • fetchEmployees()   │ • handleReject()  │   lines)      │  │
│  │ • fetchProfiles()    │ • handleReassign()│               │  │
│  ├──────────────────────┼───────────────────┼───────────────┤  │
│  │ FILE UPLOADS         │ NOTIFICATIONS     │ STATE MGMT    │  │
│  │ • uploadProof()      │ • sendNotif()     │ • 60+ useState│  │
│  │ • uploadGuidance()   │                   │               │  │
│  └──────────────────────┴───────────────────┴───────────────┘  │
│                                                                │
│  ALL IN ONE 3,800 LINE FILE! ❌                                │
└────────────────────────────────────────────────────────────────┘
```

### Why This Is A Problem

1. **Inconsistent Behavior:** When the same logic is needed elsewhere, it gets copied with slight variations, leading to inconsistencies.

2. **Ripple Effects:** A change in one responsibility (e.g., how notifications work) requires editing unrelated code.

3. **Cognitive Overload:** Developers must understand the entire file to modify any part of it.

### Recommended Solution

**Apply SRP by extracting responsibilities:**

```javascript
// BEFORE: Everything in one component
function AllTasksView() {
    // 60+ state variables
    // 30+ functions
    // 2000+ lines of JSX
}

// AFTER: Separated by responsibility
function AllTasksView() {
    // Uses custom hooks for data
    const { tasks, loading, refetch } = useTaskData(orgId, projectId);
    const { employees } = useEmployeeData(orgId);
    
    // Uses service for actions
    const handleApprove = (taskId) => taskService.approve(taskId);
    
    // Clean JSX with extracted components
    return (
        <TaskFilters />
        <TaskTable tasks={tasks} onApprove={handleApprove} />
        <AddTaskModal />
    );
}
```

---

## 3. Duplicated UserContext Across Roles

### What Is This Issue?

The **same UserContext** is duplicated across **4 different role-based modules**, with each copy having slightly different implementations.

### Evidence From Codebase

| File Location | Lines | Unique Features |
|--------------|-------|-----------------|
| `executive/context/UserContext.jsx` | 77 | Basic user data only |
| `manager/context/UserContext.jsx` | 77 | Same as executive |
| `teamlead/context/UserContext.jsx` | ~77 | Same as executive |
| `employee/context/UserContext.jsx` | **135** | **Has extra auto-checkout logic!** |

**The Critical Difference (Employee vs Others):**

```javascript
// ⚠️ ONLY in employee/context/UserContext.jsx (lines 49-102)
// This logic does NOT exist in the other 3 contexts!

// --- CHECK ATTENDANCE STATUS & AUTO-CHECKOUT ---
const { data: openSessions } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', user.id)
    .is('clock_out', null);

// Auto-checkout stale sessions from previous days
for (const session of openSessions) {
    if (session.date < today) {
        await supabase.from('attendance').update({
            clock_out: '23:59:00',
            total_hours: calculatedHours,
            status: 'present'
        }).eq('id', session.id);
    }
}
```

### Visual: The Duplication Problem

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE (BAD)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   executive/          manager/           teamlead/              │
│   └── context/        └── context/       └── context/           │
│       └── UserContext     └── UserContext    └── UserContext    │
│           (77 lines)          (77 lines)         (~77 lines)    │
│               │                   │                  │          │
│               └───────────────────┼──────────────────┘          │
│                       NEARLY IDENTICAL CODE                     │
│                                                                 │
│   employee/                                                     │
│   └── context/                                                  │
│       └── UserContext                                           │
│           (135 lines) ← HAS EXTRA AUTO-CHECKOUT LOGIC!          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Is A Problem

| Problem | Impact |
|---------|--------|
| **DRY Violation** | Same code copied 4 times |
| **Inconsistent Behavior** | Auto-checkout only works if user uses Employee dashboard |
| **Maintenance Burden** | Bug fixes must be applied to 4 files |
| **Risk of Divergence** | Easy to forget to update all copies |

**Bug Example:** If a manager-role user accesses the Manager Dashboard, their stale attendance sessions will **NOT** be auto-closed. But if they access the Employee Dashboard, they will be.

### Recommended Solution

**Create a single, shared UserContext:**

```
lib/
└── context/
    └── UserContext.jsx    ← Single source of truth (includes ALL logic)
```

```javascript
// lib/context/UserContext.jsx
export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    
    useEffect(() => {
        // 1. Fetch user profile (common logic)
        // 2. Handle auto-checkout (moved from employee context)
        // 3. Set status based on attendance
    }, []);
    
    return (
        <UserContext.Provider value={{ user, ... }}>
            {children}
        </UserContext.Provider>
    );
};
```

**Then update all module imports:**

```javascript
// BEFORE (in each module)
import { useUser } from '../context/UserContext';

// AFTER (everywhere)
import { useUser } from '@/lib/context/UserContext';
```

---

## 4. Database Queries Scattered Across Components

### What Is This Issue?

Instead of centralizing database operations in service files, Supabase queries are **scattered across 150+ locations** throughout the codebase.

### Evidence From Codebase

**Example: `tasks` table is queried directly in 50+ files:**

```
components/shared/AllTasksView.jsx           (15+ queries)
components/shared/TaskLifecyclePage.jsx      (5+ queries)
components/shared/ManagerTaskDashboard.jsx   (8+ queries)
components/manager/pages/ModulePage.jsx      (6+ queries)
components/manager/pages/DashboardHome.jsx   (5+ queries)
components/teamlead/pages/ModulePage.jsx     (4+ queries)
components/teamlead/pages/DashboardHome.jsx  (5+ queries)
components/teamlead/components/TeamTasks.jsx (5+ queries)
... and 30+ more files
```

**Example: `profiles` table is queried directly in 100+ files:**

```
Found 100+ occurrences of: supabase.from('profiles')
```

### Visual: The Scattered Query Problem

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE (BAD)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ Component1 │  │ Component2 │  │ Component3 │                 │
│  │            │  │            │  │            │                 │
│  │ supabase   │  │ supabase   │  │ supabase   │                 │
│  │ .from()    │  │ .from()    │  │ .from()    │                 │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                 │
│        │               │               │                        │
│        └───────────────┼───────────────┘                        │
│                        ▼                                        │
│                 ┌────────────┐                                  │
│                 │  Supabase  │                                  │
│                 │  Database  │                                  │
│                 └────────────┘                                  │
│                                                                 │
│  PROBLEM: 150+ different places making direct DB calls!        │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Is A Problem

| Problem | Impact |
|---------|--------|
| **No Single Source of Truth** | Query logic varies between files |
| **Schema Changes Are Painful** | Rename a column → edit 50+ files |
| **No Caching** | Same data fetched repeatedly |
| **Inconsistent Field Selection** | Some use `select('*')`, some don't |
| **Hard to Optimize** | Can't add indexes without knowing all queries |
| **Security Audit Difficulty** | Must check 150+ files for security issues |

### Recommended Solution

**Create centralized service files:**

```
services/
├── taskService.js       ← All task-related queries
├── profileService.js    ← All profile-related queries
├── attendanceService.js ← All attendance-related queries
├── messageService.js    ← Already exists! ✓
└── notificationService.js ← Already exists! ✓
```

```javascript
// services/taskService.js
class TaskService {
    async getTasks(orgId, projectId, filters) {
        return supabase
            .from('tasks')
            .select('id, title, status, priority, due_date, assigned_to')
            .eq('org_id', orgId)
            .eq('project_id', projectId);
    }
    
    async createTask(taskData) { ... }
    async updateTask(taskId, updates) { ... }
    async deleteTask(taskId) { ... }
    async approvePhase(taskId, phaseKey) { ... }
}

export const taskService = new TaskService();
```

**Then use in components:**

```javascript
// BEFORE
const { data } = await supabase.from('tasks').select('*').eq('org_id', orgId);

// AFTER
const tasks = await taskService.getTasks(orgId, projectId);
```

---

## 5. Direct Supabase Coupling in UI Components

### What Is This Issue?

**Every UI component** directly imports and uses the Supabase client, tightly coupling the presentation layer to the database layer.

### Evidence From Codebase

```javascript
// This pattern appears in 100+ components:
import { supabase } from '../../lib/supabaseClient';

const MyComponent = () => {
    useEffect(() => {
        const fetchData = async () => {
            const { data } = await supabase.from('tasks').select('*');
            // ...
        };
        fetchData();
    }, []);
    
    return <div>...</div>;
};
```

### Visual: The Coupling Problem

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE (BAD)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────┐              │
│  │              PRESENTATION LAYER               │              │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐          │              │
│  │  │Component│ │Component│ │Component│          │              │
│  │  │ import  │ │ import  │ │ import  │          │              │
│  │  │supabase │ │supabase │ │supabase │ ← TIGHT  │              │
│  │  └────┬────┘ └────┬────┘ └────┬────┘  COUPLING│              │
│  └───────┼───────────┼───────────┼───────────────┘              │
│          │           │           │                              │
│          ▼           ▼           ▼                              │
│  ┌───────────────────────────────────────────────┐              │
│  │                  SUPABASE CLIENT              │              │
│  └───────────────────────────────────────────────┘              │
│                                                                 │
│  NO ABSTRACTION LAYER = COMPONENTS KNOW ABOUT DATABASE SCHEMA  │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Is A Problem

| Problem | Impact |
|---------|--------|
| **Cannot Mock for Testing** | UI tests require real database |
| **Vendor Lock-in** | Switching from Supabase to Firebase = rewrite everything |
| **Components Know Schema** | UI knows column names, table structure |
| **No Request Interception** | Can't add logging, error handling globally |
| **Hard to Debug** | Network errors show in random components |

### Recommended Solution

**Add a service/repository layer:**

```
┌─────────────────────────────────────────────────────────────────┐
│                  RECOMMENDED ARCHITECTURE (GOOD)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────┐              │
│  │              PRESENTATION LAYER               │              │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐          │              │
│  │  │Component│ │Component│ │Component│          │              │
│  │  │ uses    │ │ uses    │ │ uses    │          │              │
│  │  │ service │ │ service │ │ service │          │              │
│  │  └────┬────┘ └────┬────┘ └────┬────┘          │              │
│  └───────┼───────────┼───────────┼───────────────┘              │
│          │           │           │                              │
│          ▼           ▼           ▼                              │
│  ┌───────────────────────────────────────────────┐              │
│  │             SERVICE LAYER (NEW)               │              │
│  │  taskService │ profileService │ msgService    │ ← ABSTRACTION│
│  └───────────────────────┬───────────────────────┘              │
│                          │                                      │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────┐              │
│  │                  SUPABASE CLIENT              │              │
│  └───────────────────────────────────────────────┘              │
│                                                                 │
│  COMPONENTS DON'T KNOW ABOUT DATABASE! ✅                       │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits of abstraction:**

```javascript
// For testing, can mock the service:
jest.mock('../services/taskService', () => ({
    getTasks: jest.fn(() => Promise.resolve(mockTasks))
}));

// For switching backends:
// Just change implementation in taskService.js
// Components don't need any changes!
```

---

## 6. Duplicated Core IDs Pattern

### What Is This Issue?

Core identifiers like `userId`, `orgId`, `teamId` are fetched and managed **separately in each module** instead of being fetched once and shared globally.

### Evidence From Codebase

**Each module's UserContext independently fetches these IDs:**

```javascript
// executive/context/UserContext.jsx
const [userId, setUserId] = useState(null);
const [orgId, setOrgId] = useState(null);

// manager/context/UserContext.jsx  
const [userId, setUserId] = useState(null);
const [orgId, setOrgId] = useState(null);

// teamlead/context/UserContext.jsx
const [userId, setUserId] = useState(null);
const [orgId, setOrgId] = useState(null);

// employee/context/UserContext.jsx
const [userId, setUserId] = useState(null);
const [orgId, setOrgId] = useState(null);
const [teamId, setTeamId] = useState(null);  // Only employee has this!
```

**Additionally, many components re-fetch these IDs themselves:**

```javascript
// Pattern found in 30+ components:
useEffect(() => {
    const getUserId = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setLocalUserId(user.id);
        
        // Then fetch profile for orgId
        const { data: profile } = await supabase
            .from('profiles')
            .select('org_id')
            .eq('id', user.id)
            .single();
        setLocalOrgId(profile.org_id);
    };
    getUserId();
}, []);
```

### Visual: The Duplication

```
┌─────────────────────────────────────────────────────────────────┐
│                    CORE IDS DUPLICATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   App Loads                                                     │
│       │                                                         │
│       ├──► Executive Module ──► UserContext ──► Fetches IDs     │
│       │                                            │            │
│       ├──► Manager Module ──► UserContext ──► Fetches IDs       │
│       │                                         │               │
│       ├──► TeamLead Module ──► UserContext ──► Fetches IDs      │
│       │                                          │              │
│       └──► Employee Module ──► UserContext ──► Fetches IDs      │
│                                                   │             │
│                                                   │             │
│   RESULT: 4 separate API calls for the SAME user data!         │
│                                                                 │
│   Plus 30+ additional components that fetch IDs themselves!    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Is A Problem

| Problem | Impact |
|---------|--------|
| **Redundant API Calls** | Same data fetched 4+ times on load |
| **Inconsistent State** | If one fetch fails, modules have different data |
| **Props Drilling** | IDs must be passed through component trees |
| **Missing IDs in Some Contexts** | `teamId` only exists in employee context |
| **Race Conditions** | Multiple parallel fetches for same user |

### Recommended Solution

**Single global AuthContext at app root:**

```javascript
// lib/context/AuthContext.jsx
export const AuthProvider = ({ children }) => {
    const [authState, setAuthState] = useState({
        userId: null,
        orgId: null,
        teamId: null,
        role: null,
        profile: null,
        isLoading: true
    });
    
    useEffect(() => {
        // Single fetch on app load
        const initialize = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                
                setAuthState({
                    userId: user.id,
                    orgId: profile.org_id,
                    teamId: profile.team_id,
                    role: profile.role,
                    profile: profile,
                    isLoading: false
                });
            }
        };
        
        initialize();
    }, []);
    
    return (
        <AuthContext.Provider value={authState}>
            {children}
        </AuthContext.Provider>
    );
};
```

**Usage anywhere in the app:**

```javascript
// Any component, any module
import { useAuth } from '@/lib/context/AuthContext';

function MyComponent() {
    const { userId, orgId, teamId } = useAuth();
    // IDs are immediately available, no fetching needed!
}
```

---

## Summary: Action Items

| # | Issue | Priority | Effort | Fix |
|---|-------|----------|--------|-----|
| 1 | Massive Components | 🔴 High | 3-5 days | Split into smaller components |
| 2 | SRP Violations | 🔴 High | 2-3 days | Extract hooks and services |
| 3 | Duplicated UserContext | 🔴 High | 4-6 hours | Create single shared context |
| 4 | Scattered DB Queries | 🟠 Medium | 2-3 days | Create service layer |
| 5 | Direct Supabase Coupling | 🟠 Medium | 2-3 days | Abstract through services |
| 6 | Duplicated Core IDs | 🔴 High | 4-6 hours | Create AuthContext |

---

## Recommended Refactoring Order

```
Week 1:
├── 1. Consolidate UserContext (fixes issues #3 and #6)
└── 2. Create AuthContext for core IDs

Week 2:
├── 3. Create taskService.js
└── 4. Create profileService.js

Week 3-4:
├── 5. Split AllTasksView.jsx
└── 6. Split MessagingHub.jsx
```

---

> **Conclusion:** These architectural issues, while not currently breaking the application, create significant technical debt that will slow down future development, make testing difficult, and create maintenance challenges. Addressing them incrementally will improve code quality and developer productivity.
