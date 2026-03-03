"""
Task Lifecycle Monitoring and Proactive Assistance Module

This module provides deterministic, lifecycle-aware task monitoring that:
- Detects when tasks are not progressing through lifecycle stages
- Sends proactive reminders based on stagnation and deadlines
- Offers help when progress stalls
- Routes all guidance requests to the SLM

NO LLMs are used for monitoring or decision-making.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from enum import Enum
import json


class LifecycleStage(str, Enum):
    """Ordered lifecycle stages for task progression"""
    REQUIREMENT_REFINER = "requirement_refiner"
    DESIGN_GUIDANCE = "design_guidance"
    BUILD_GUIDANCE = "build_guidance"
    ACCEPTANCE_CRITERIA = "acceptance_criteria"
    DEPLOYMENT = "deployment"


class SubState(str, Enum):
    """Sub-states within each lifecycle stage"""
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    REVIEW = "review"
    COMPLETED = "completed"


class ReminderType(str, Enum):
    """Types of reminders sent to users"""
    NOT_STARTED = "not_started"
    STAGNATION_HELP = "stagnation_help"
    DEADLINE_APPROACHING = "deadline_approaching"
    DEADLINE_URGENT = "deadline_urgent"
    DEADLINE_OVERDUE = "deadline_overdue"


class TaskMonitorConfig:
    """Configuration for task monitoring thresholds and cooldowns"""
    
    # Time thresholds (in hours)
    NOT_STARTED_THRESHOLD = 24  # Remind if not started after 24 hours
    STAGNATION_THRESHOLD = 48   # Detect stagnation after 48 hours in same stage
    
    # Deadline proximity thresholds (in hours)
    DEADLINE_WARNING_THRESHOLD = 72   # 3 days before deadline
    DEADLINE_URGENT_THRESHOLD = 24    # 1 day before deadline
    
    # Cooldown periods (in hours) - prevent reminder spam
    NOT_STARTED_COOLDOWN = 24
    STAGNATION_COOLDOWN = 48
    DEADLINE_WARNING_COOLDOWN = 24
    DEADLINE_URGENT_COOLDOWN = 8
    DEADLINE_OVERDUE_COOLDOWN = 4  # More frequent for overdue tasks
    
    # Lifecycle stage order
    LIFECYCLE_ORDER = [
        LifecycleStage.REQUIREMENT_REFINER,
        LifecycleStage.DESIGN_GUIDANCE,
        LifecycleStage.BUILD_GUIDANCE,
        LifecycleStage.ACCEPTANCE_CRITERIA,
        LifecycleStage.DEPLOYMENT
    ]
    
    @classmethod
    def get_stage_index(cls, stage: str) -> int:
        """Get the index of a lifecycle stage in the progression order"""
        try:
            return cls.LIFECYCLE_ORDER.index(LifecycleStage(stage))
        except (ValueError, AttributeError):
            return -1
    
    @classmethod
    def is_final_stage(cls, stage: str) -> bool:
        """Check if a stage is the final lifecycle stage"""
        return stage == LifecycleStage.DEPLOYMENT.value


class TaskMonitor:
    """
    Deterministic task monitoring engine that detects stagnation and triggers reminders.
    
    This class does NOT use any LLMs. All logic is rule-based and deterministic.
    """
    
    def __init__(self, config: TaskMonitorConfig = None):
        self.config = config or TaskMonitorConfig()
        self.reminder_history: Dict[str, Dict[str, datetime]] = {}
    
    def check_task(self, task: Dict) -> Optional[Dict]:
        """
        Check a single task for monitoring conditions.
        
        Args:
            task: Task dictionary with fields:
                - id: str
                - lifecycle_state: str
                - sub_state: str
                - assigned_to: str
                - start_date: str (ISO format)
                - due_date: str (ISO format)
                - created_at: str (ISO format)
                - lifecycle_state_updated_at: str (ISO format) - when stage last changed
        
        Returns:
            Reminder dict if action needed, None otherwise:
                {
                    "task_id": str,
                    "assigned_to": str,
                    "reminder_type": ReminderType,
                    "message": str,
                    "urgency": int (1-5),
                    "offer_help": bool
                }
        """
        task_id = task.get("id")
        if not task_id:
            return None
        
        # Skip if task is completed or in final stage with completed sub-state
        if self._is_task_complete(task):
            return None
        
        current_time = datetime.utcnow()
        
        # Check conditions in priority order
        
        # 1. Check if task not started
        not_started_reminder = self._check_not_started(task, current_time)
        if not_started_reminder:
            return not_started_reminder
        
        # 2. Check for lifecycle stagnation
        stagnation_reminder = self._check_stagnation(task, current_time)
        if stagnation_reminder:
            return stagnation_reminder
        
        # 3. Check deadline proximity
        deadline_reminder = self._check_deadline(task, current_time)
        if deadline_reminder:
            return deadline_reminder
        
        return None
    
    def _is_task_complete(self, task: Dict) -> bool:
        """Check if task is complete and should stop monitoring"""
        lifecycle_state = task.get("lifecycle_state", "")
        sub_state = task.get("sub_state", "")
        status = task.get("status", "")
        
        # Task is complete if status is completed/closed
        if status in ["completed", "closed", "done"]:
            return True
        
        # Task is complete if in final stage with completed sub-state
        if (self.config.is_final_stage(lifecycle_state) and 
            sub_state == SubState.COMPLETED.value):
            return True
        
        return False
    
    def _check_not_started(self, task: Dict, current_time: datetime) -> Optional[Dict]:
        """Check if task has not been started after sufficient time"""
        task_id = task.get("id")
        lifecycle_state = task.get("lifecycle_state", "")
        created_at_str = task.get("created_at")
        
        if not created_at_str:
            return None
        
        # Only trigger if still in first lifecycle stage
        if self.config.get_stage_index(lifecycle_state) != 0:
            return None
        
        # Check if enough time has passed since creation
        created_at = self._parse_datetime(created_at_str)
        if not created_at:
            return None
        
        hours_since_creation = (current_time - created_at).total_seconds() / 3600
        
        if hours_since_creation < self.config.NOT_STARTED_THRESHOLD:
            return None
        
        # Check cooldown
        if not self._check_cooldown(task_id, ReminderType.NOT_STARTED, current_time):
            return None
        
        # Record this reminder
        self._record_reminder(task_id, ReminderType.NOT_STARTED, current_time)
        
        return {
            "task_id": task_id,
            "assigned_to": task.get("assigned_to"),
            "reminder_type": ReminderType.NOT_STARTED.value,
            "message": f"Gentle reminder: Task '{task.get('title', 'Untitled')}' was assigned {int(hours_since_creation)} hours ago. Starting early helps ensure smooth progress!",
            "urgency": 2,
            "offer_help": False
        }
    
    def _check_stagnation(self, task: Dict, current_time: datetime) -> Optional[Dict]:
        """Check if task is stagnating in current lifecycle stage"""
        task_id = task.get("id")
        lifecycle_state = task.get("lifecycle_state", "")
        lifecycle_updated_at_str = task.get("lifecycle_state_updated_at")
        
        # Skip if in final stage
        if self.config.is_final_stage(lifecycle_state):
            return None
        
        if not lifecycle_updated_at_str:
            # Fallback to created_at if lifecycle_state_updated_at not available
            lifecycle_updated_at_str = task.get("created_at")
        
        if not lifecycle_updated_at_str:
            return None
        
        lifecycle_updated_at = self._parse_datetime(lifecycle_updated_at_str)
        if not lifecycle_updated_at:
            return None
        
        hours_in_stage = (current_time - lifecycle_updated_at).total_seconds() / 3600
        
        if hours_in_stage < self.config.STAGNATION_THRESHOLD:
            return None
        
        # Check cooldown
        if not self._check_cooldown(task_id, ReminderType.STAGNATION_HELP, current_time):
            return None
        
        # Record this reminder
        self._record_reminder(task_id, ReminderType.STAGNATION_HELP, current_time)
        
        stage_name = lifecycle_state.replace("_", " ").title()
        
        return {
            "task_id": task_id,
            "assigned_to": task.get("assigned_to"),
            "reminder_type": ReminderType.STAGNATION_HELP.value,
            "message": f"It looks like task '{task.get('title', 'Untitled')}' has been in {stage_name} stage for {int(hours_in_stage)} hours without progressing. Do you need any help to move forward?",
            "urgency": 3,
            "offer_help": True  # This triggers SLM routing if user responds
        }
    
    def _check_deadline(self, task: Dict, current_time: datetime) -> Optional[Dict]:
        """Check if deadline is approaching or overdue"""
        task_id = task.get("id")
        due_date_str = task.get("due_date")
        
        if not due_date_str:
            return None
        
        due_date = self._parse_datetime(due_date_str)
        if not due_date:
            return None
        
        hours_until_deadline = (due_date - current_time).total_seconds() / 3600
        
        # OVERDUE - Highest priority!
        if hours_until_deadline < 0:
            hours_overdue = abs(hours_until_deadline)
            reminder_type = ReminderType.DEADLINE_OVERDUE
            cooldown = self.config.DEADLINE_OVERDUE_COOLDOWN
            urgency = 5
            
            # Format date with relative description
            due_date_formatted = due_date.strftime("%b %d")  # e.g., "Jan 8"
            
            # Determine relative date
            days_overdue = hours_overdue / 24
            if days_overdue < 1:
                relative_date = "today"
            elif days_overdue < 2:
                relative_date = "yesterday"
            else:
                relative_date = f"{int(days_overdue)} days ago"
            
            message = f"🚨 OVERDUE: Task '{task.get('title', 'Untitled')}' was due on {due_date_formatted} ({relative_date}). Complete this immediately!"
        
        # Determine urgency level for upcoming deadlines
        elif hours_until_deadline <= self.config.DEADLINE_URGENT_THRESHOLD:
            reminder_type = ReminderType.DEADLINE_URGENT
            cooldown = self.config.DEADLINE_URGENT_COOLDOWN
            urgency = 5
            message = f"⚠️ URGENT: Task '{task.get('title', 'Untitled')}' is due in {int(hours_until_deadline)} hours! Please prioritize completion."
        elif hours_until_deadline <= self.config.DEADLINE_WARNING_THRESHOLD:
            reminder_type = ReminderType.DEADLINE_APPROACHING
            cooldown = self.config.DEADLINE_WARNING_COOLDOWN
            urgency = 4
            message = f"Reminder: Task '{task.get('title', 'Untitled')}' is due in {int(hours_until_deadline)} hours. Please ensure you're on track."
        else:
            return None
        
        # Check cooldown
        if not self._check_cooldown(task_id, reminder_type, current_time, cooldown):
            return None
        
        # Record this reminder
        self._record_reminder(task_id, reminder_type, current_time)
        
        return {
            "task_id": task_id,
            "assigned_to": task.get("assigned_to"),
            "reminder_type": reminder_type.value,
            "message": message,
            "urgency": urgency,
            "offer_help": False
        }
    
    def _check_cooldown(self, task_id: str, reminder_type: ReminderType, 
                       current_time: datetime, cooldown_hours: Optional[int] = None) -> bool:
        """Check if enough time has passed since last reminder of this type"""
        if cooldown_hours is None:
            cooldown_map = {
                ReminderType.NOT_STARTED: self.config.NOT_STARTED_COOLDOWN,
                ReminderType.STAGNATION_HELP: self.config.STAGNATION_COOLDOWN,
                ReminderType.DEADLINE_APPROACHING: self.config.DEADLINE_WARNING_COOLDOWN,
                ReminderType.DEADLINE_URGENT: self.config.DEADLINE_URGENT_COOLDOWN,
                ReminderType.DEADLINE_OVERDUE: self.config.DEADLINE_OVERDUE_COOLDOWN
            }
            cooldown_hours = cooldown_map.get(reminder_type, 24)
        
        if task_id not in self.reminder_history:
            return True
        
        last_reminder_time = self.reminder_history[task_id].get(reminder_type.value)
        if not last_reminder_time:
            return True
        
        hours_since_last = (current_time - last_reminder_time).total_seconds() / 3600
        return hours_since_last >= cooldown_hours
    
    def _record_reminder(self, task_id: str, reminder_type: ReminderType, timestamp: datetime):
        """Record that a reminder was sent"""
        if task_id not in self.reminder_history:
            self.reminder_history[task_id] = {}
        self.reminder_history[task_id][reminder_type.value] = timestamp
    
    def _parse_datetime(self, dt_str: str) -> Optional[datetime]:
        """Parse datetime string in various formats"""
        if not dt_str:
            return None
        
        formats = [
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d"
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(dt_str, fmt)
            except ValueError:
                continue
        
        return None
    
    def batch_check_tasks(self, tasks: List[Dict]) -> List[Dict]:
        """
        Check multiple tasks and return all reminders that should be sent.
        
        Args:
            tasks: List of task dictionaries
        
        Returns:
            List of reminder dictionaries
        """
        reminders = []
        for task in tasks:
            reminder = self.check_task(task)
            if reminder:
                reminders.append(reminder)
        return reminders


class NotificationService:
    """
    Service to send notifications to users.
    
    This should be integrated with your existing notification system.
    """
    
    def __init__(self, supabase_client):
        """
        Args:
            supabase_client: Your Supabase client instance
        """
        self.supabase = supabase_client
    
    def send_reminder(self, reminder: Dict) -> bool:
        """
        Send a reminder notification to the user.
        
        Args:
            reminder: Reminder dict from TaskMonitor
        
        Returns:
            True if sent successfully
        """
        try:
            notification_data = {
                "receiver_id": reminder["assigned_to"],
                "type": reminder["reminder_type"],
                "message": reminder["message"],
                "data": json.dumps({
                    "task_id": reminder["task_id"],
                    "urgency": reminder["urgency"],
                    "offer_help": reminder.get("offer_help", False)
                }),
                "is_read": False
            }
            
            self.supabase.table("notifications").insert(notification_data).execute()
            return True
        except Exception as e:
            print(f"Failed to send notification: {e}")
            return False


# ==========================================
# INTEGRATION INSTRUCTIONS
# ==========================================

"""
INTEGRATION GUIDE:

1. SETUP:
   - Import this module in your backend
   - Initialize TaskMonitor with optional custom config
   - Initialize NotificationService with your Supabase client

2. SCHEDULED MONITORING:
   - Run batch_check_tasks() periodically (e.g., every 1-4 hours)
   - Fetch active tasks from database
   - Send reminders via NotificationService

3. CHATBOT INTEGRATION:
   - When user receives a reminder with "offer_help": true
   - If user responds asking for help, route to SLM
   - Pass task context to SLM: task_id, lifecycle_stage, description
   - SLM provides stage-specific guidance

4. DATABASE REQUIREMENTS:
   Tasks table must have:
   - id (uuid)
   - lifecycle_state (text)
   - sub_state (text)
   - assigned_to (uuid)
   - start_date (date)
   - due_date (date)
   - created_at (timestamp)
   - lifecycle_state_updated_at (timestamp) - IMPORTANT: Update this when lifecycle_state changes
   - title (text)
   - status (text)

   Notifications table must have:
   - receiver_id (uuid)
   - type (text)
   - message (text)
   - data (jsonb)
   - is_read (bool)
   - created_at (timestamp)

5. EXAMPLE USAGE:

```python
from services.task_monitor import TaskMonitor, NotificationService, TaskMonitorConfig

# Initialize
monitor = TaskMonitor()
notifier = NotificationService(supabase_client)

# Fetch active tasks
tasks = supabase_client.table("tasks").select("*").neq("status", "completed").execute()

# Check for reminders
reminders = monitor.batch_check_tasks(tasks.data)

# Send notifications
for reminder in reminders:
    notifier.send_reminder(reminder)
```

6. CRON JOB / SCHEDULER:
   Set up a background job to run every 2-4 hours:
   
```python
# In your scheduler (e.g., APScheduler, Celery, or cron)
def monitor_tasks_job():
    monitor = TaskMonitor()
    notifier = NotificationService(supabase_client)
    
    tasks = supabase_client.table("tasks")\
        .select("*")\
        .neq("status", "completed")\
        .execute()
    
    reminders = monitor.batch_check_tasks(tasks.data)
    
    for reminder in reminders:
        notifier.send_reminder(reminder)
        print(f"Sent {reminder['reminder_type']} reminder for task {reminder['task_id']}")
```

7. SLM ROUTING:
   When user responds to a help offer:
   
```python
# In your chatbot handler
if notification.data.get("offer_help") and user_response_indicates_help_needed:
    task_id = notification.data["task_id"]
    task = fetch_task(task_id)
    
    # Route to SLM with context
    slm_response = slm_client.query(
        user_message=user_response,
        context={
            "task_id": task_id,
            "lifecycle_stage": task["lifecycle_state"],
            "task_description": task["description"],
            "intent": "task_guidance"
        }
    )
    
    return slm_response
```

8. CUSTOMIZATION:
   Adjust thresholds in TaskMonitorConfig:
   
```python
config = TaskMonitorConfig()
config.STAGNATION_THRESHOLD = 72  # 3 days instead of 2
config.DEADLINE_WARNING_THRESHOLD = 96  # 4 days instead of 3

monitor = TaskMonitor(config)
```

9. IMPORTANT DATABASE TRIGGER:
   Create a trigger to auto-update lifecycle_state_updated_at:
   
```sql
CREATE OR REPLACE FUNCTION update_lifecycle_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lifecycle_state IS DISTINCT FROM OLD.lifecycle_state THEN
        NEW.lifecycle_state_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lifecycle_state_change
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_lifecycle_timestamp();
```

10. MONITORING & LOGGING:
    Add logging to track reminder effectiveness:
    
```python
import logging

logger = logging.getLogger(__name__)

for reminder in reminders:
    logger.info(f"Task {reminder['task_id']}: {reminder['reminder_type']} "
                f"(urgency: {reminder['urgency']})")
    notifier.send_reminder(reminder)
```
"""
