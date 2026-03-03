# Task Monitor Setup Guide

Complete guide to integrate the Task Lifecycle Monitoring system into your TalentOps application.

## 📋 Prerequisites

- Supabase database with `tasks` and `notifications` tables
- Python 3.8+
- Access to run database migrations

## 🚀 Quick Start (5 Steps)

### Step 1: Run Database Migration

Execute the SQL migration to add lifecycle tracking:

```bash
# Option A: Using Supabase CLI
supabase db push migrations/add_lifecycle_tracking.sql

# Option B: Run directly in Supabase SQL Editor
# Copy contents of migrations/add_lifecycle_tracking.sql and execute
```

This adds:
- `lifecycle_state_updated_at` column
- Trigger to auto-update when lifecycle changes
- Index for efficient monitoring queries

### Step 2: Verify Database Schema

Check that the column was added:

```sql
SELECT lifecycle_state, lifecycle_state_updated_at, title 
FROM tasks 
LIMIT 5;
```

### Step 3: Test the Monitor

Run a quick test:

```python
from services.task_monitor import TaskMonitor
from server import supabase

# Initialize monitor
monitor = TaskMonitor()

# Fetch a few tasks
tasks = supabase.table("tasks").select("*").limit(10).execute()

# Check for reminders
reminders = monitor.batch_check_tasks(tasks.data)

print(f"Found {len(reminders)} reminders")
for r in reminders:
    print(f"  - {r['reminder_type']}: {r['message']}")
```

### Step 4: Choose Deployment Method

Pick one based on your infrastructure:

#### Option A: Standalone Process (Simplest)

```bash
cd modalgateway/slm-backend
python services/task_monitor_scheduler.py
# Choose option 1 for continuous monitoring
```

#### Option B: Integrate with Existing FastAPI Server

Add to your `server.py`:

```python
from services.task_monitor_scheduler import TaskMonitorScheduler
import threading

# In your lifespan or startup event
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start monitoring in background
    scheduler = TaskMonitorScheduler(supabase, interval_hours=2)
    
    def run_monitor():
        scheduler.start_continuous()
    
    monitor_thread = threading.Thread(target=run_monitor, daemon=True)
    monitor_thread.start()
    
    yield
    
app = FastAPI(lifespan=lifespan)
```

#### Option C: Cron Job (For production)

Add to crontab:

```bash
# Run every 2 hours
0 */2 * * * cd /path/to/slm-backend && python -c "from services.task_monitor_scheduler import example_single_run; example_single_run()"
```

### Step 5: Integrate with Chatbot

Update your chatbot handler to route help requests to SLM:

```python
# In your chatbot query handler
async def handle_chatbot_query(query: str, user_id: str, context: dict):
    
    # Check if this is a response to a help offer
    if context.get("notification_type") == "stagnation_help":
        task_id = context.get("task_id")
        
        # Fetch task details
        task = supabase.table("tasks").select("*").eq("id", task_id).single().execute()
        
        # Route to SLM with task context
        slm_context = {
            "intent": "task_guidance",
            "task_id": task_id,
            "lifecycle_stage": task.data["lifecycle_state"],
            "task_title": task.data["title"],
            "task_description": task.data.get("description", "")
        }
        
        # Call your SLM
        response = await slm_client.query(query, context=slm_context)
        return response
    
    # Normal chatbot flow
    # ...
```

## ⚙️ Configuration

Customize thresholds in `services/task_monitor.py`:

```python
from services.task_monitor import TaskMonitorConfig

config = TaskMonitorConfig()

# Adjust thresholds (in hours)
config.NOT_STARTED_THRESHOLD = 48        # Default: 24
config.STAGNATION_THRESHOLD = 72         # Default: 48
config.DEADLINE_WARNING_THRESHOLD = 96   # Default: 72
config.DEADLINE_URGENT_THRESHOLD = 48    # Default: 24

# Adjust cooldowns (in hours)
config.STAGNATION_COOLDOWN = 72          # Default: 48

# Use custom config
from services.task_monitor import TaskMonitor
monitor = TaskMonitor(config)
```

## 📊 Monitoring & Logs

### View Reminder History

```python
from services.task_monitor import TaskMonitor

monitor = TaskMonitor()
# After running checks...
print(monitor.reminder_history)
# Output: {'task-uuid-1': {'stagnation_help': datetime(...)}, ...}
```

### Check Scheduler Status

```python
from services.task_monitor_scheduler import TaskMonitorScheduler
from server import supabase

scheduler = TaskMonitorScheduler(supabase)
stats = scheduler.run_monitoring_cycle()

print(stats)
# Output: {
#   'tasks_checked': 45,
#   'reminders_generated': 3,
#   'reminders_sent': 3,
#   'reminders_failed': 0
# }
```

## 🧪 Testing

### Test Stagnation Detection

```python
# Create a test task stuck in a stage
test_task = {
    "id": "test-123",
    "title": "Test Task",
    "lifecycle_state": "requirement_refiner",
    "sub_state": "in_progress",
    "assigned_to": "user-uuid",
    "created_at": "2026-01-01T00:00:00Z",
    "lifecycle_state_updated_at": "2026-01-01T00:00:00Z",  # 7 days ago
    "due_date": "2026-01-15T00:00:00Z",
    "status": "in_progress"
}

monitor = TaskMonitor()
reminder = monitor.check_task(test_task)

if reminder:
    print(f"✓ Stagnation detected: {reminder['message']}")
else:
    print("✗ No reminder (check thresholds)")
```

### Test Deadline Detection

```python
from datetime import datetime, timedelta

# Create task with approaching deadline
test_task = {
    "id": "test-456",
    "title": "Urgent Task",
    "lifecycle_state": "build_guidance",
    "assigned_to": "user-uuid",
    "created_at": datetime.utcnow().isoformat(),
    "lifecycle_state_updated_at": datetime.utcnow().isoformat(),
    "due_date": (datetime.utcnow() + timedelta(hours=20)).isoformat(),  # 20 hours away
    "status": "in_progress"
}

reminder = monitor.check_task(test_task)
assert reminder['reminder_type'] == 'deadline_urgent'
print(f"✓ Deadline reminder: {reminder['message']}")
```

## 🔍 Troubleshooting

### No Reminders Being Generated

1. **Check lifecycle_state_updated_at exists:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'tasks' AND column_name = 'lifecycle_state_updated_at';
   ```

2. **Verify tasks have the column populated:**
   ```sql
   SELECT COUNT(*) FROM tasks WHERE lifecycle_state_updated_at IS NULL;
   ```
   Should return 0.

3. **Check task statuses:**
   ```sql
   SELECT status, COUNT(*) FROM tasks GROUP BY status;
   ```
   Reminders only sent for non-completed tasks.

### Reminders Not Sending

1. **Check notifications table exists:**
   ```sql
   SELECT * FROM notifications LIMIT 1;
   ```

2. **Verify NotificationService:**
   ```python
   from services.task_monitor import NotificationService
   from server import supabase
   
   notifier = NotificationService(supabase)
   test_reminder = {
       "task_id": "test",
       "assigned_to": "user-uuid",
       "reminder_type": "test",
       "message": "Test notification",
       "urgency": 1
   }
   
   success = notifier.send_reminder(test_reminder)
   print(f"Send success: {success}")
   ```

### Scheduler Not Running

1. **Check for errors in logs**
2. **Verify Supabase connection:**
   ```python
   from server import supabase
   result = supabase.table("tasks").select("id").limit(1).execute()
   print(f"Connection OK: {len(result.data) >= 0}")
   ```

## 📈 Production Recommendations

1. **Use APScheduler or Celery** for robust scheduling
2. **Add logging** to track monitoring cycles
3. **Set up alerts** if scheduler fails
4. **Monitor notification delivery** rates
5. **Adjust thresholds** based on team feedback

## 🎯 SLM Guidance Examples

When user responds to stagnation help, provide stage-specific guidance:

```python
STAGE_GUIDANCE = {
    "requirement_refiner": "Let's clarify the requirements. What specific outcomes are you trying to achieve?",
    "design_guidance": "Let's work on the design approach. Have you considered the architecture and data flow?",
    "build_guidance": "Let's tackle the implementation. What specific technical challenge are you facing?",
    "acceptance_criteria": "Let's review the acceptance criteria. Does the implementation meet all requirements?",
    "deployment": "Let's prepare for deployment. Have you tested in a staging environment?"
}

# In SLM handler
stage = context.get("lifecycle_stage")
guidance = STAGE_GUIDANCE.get(stage, "How can I help you progress on this task?")
```

## ✅ Verification Checklist

- [ ] Database migration executed successfully
- [ ] `lifecycle_state_updated_at` column exists and populated
- [ ] Trigger updates timestamp when lifecycle changes
- [ ] Test monitoring returns expected reminders
- [ ] Scheduler runs without errors
- [ ] Notifications appear in database
- [ ] Chatbot routes help requests to SLM
- [ ] Cooldowns prevent spam
- [ ] Monitoring stops for completed tasks

## 🆘 Support

If you encounter issues:

1. Check the module docstrings in `task_monitor.py`
2. Review integration examples in `task_monitor_scheduler.py`
3. Verify database schema matches requirements
4. Test with a single task first before batch processing

---

**Module Version:** 1.0  
**Last Updated:** 2026-01-08  
**Compatibility:** Python 3.8+, Supabase
