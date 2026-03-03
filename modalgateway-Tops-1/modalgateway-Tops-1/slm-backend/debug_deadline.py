"""
Debug script to check why deadline notifications aren't being generated
"""
import sys
sys.path.insert(0, r'C:\Users\DELL\Desktop\T-ops\Talent Ops\modalgateway\slm-backend')

from server import supabase
from services.task_monitor import TaskMonitor
from datetime import datetime
import json

print("=" * 70)
print("DEBUGGING TASK MONITOR - DEADLINE NOTIFICATIONS")
print("=" * 70)

# Fetch the specific task
print("\n1. Fetching task 'SLM Chat Bot Development'...")
task_response = supabase.table("tasks")\
    .select("*")\
    .ilike("title", "%SLM%Chat%")\
    .execute()

if not task_response.data:
    print("   Task not found! Fetching all active tasks...")
    task_response = supabase.table("tasks")\
        .select("*")\
        .neq("status", "completed")\
        .execute()

tasks = task_response.data
print(f"   Found {len(tasks)} tasks")

# Show task details
for task in tasks[:3]:
    print(f"\n   Task: {task.get('title', 'No title')}")
    print(f"   - ID: {task.get('id')}")
    print(f"   - Due Date: {task.get('due_date')}")
    print(f"   - Status: {task.get('status')}")
    print(f"   - Lifecycle: {task.get('lifecycle_state')}")
    print(f"   - Assigned To: {task.get('assigned_to')}")
    
    # Check deadline
    if task.get('due_date'):
        due_date_str = task.get('due_date')
        print(f"   - Due date string: '{due_date_str}' (type: {type(due_date_str)})")
        
        # Try parsing
        try:
            from datetime import datetime
            due_date = datetime.strptime(due_date_str, "%Y-%m-%d")
            now = datetime.utcnow()
            hours_until = (due_date - now).total_seconds() / 3600
            print(f"   - Hours until deadline: {hours_until:.1f}")
            
            if hours_until < 0:
                print(f"   - STATUS: OVERDUE by {abs(hours_until):.1f} hours!")
            elif hours_until < 24:
                print(f"   - STATUS: URGENT (less than 24 hours)")
            elif hours_until < 72:
                print(f"   - STATUS: APPROACHING (less than 72 hours)")
            else:
                print(f"   - STATUS: Not urgent yet")
        except Exception as e:
            print(f"   - ERROR parsing date: {e}")

print("\n" + "=" * 70)
print("2. Running Task Monitor Check...")
print("=" * 70)

monitor = TaskMonitor()

for task in tasks[:3]:
    print(f"\nChecking: {task.get('title', 'No title')}")
    reminder = monitor.check_task(task)
    
    if reminder:
        print(f"   REMINDER GENERATED:")
        print(f"   - Type: {reminder['reminder_type']}")
        print(f"   - Urgency: {reminder['urgency']}")
        print(f"   - Message: {reminder['message'][:100]}...")
    else:
        print(f"   No reminder (task is OK or doesn't meet criteria)")

print("\n" + "=" * 70)
print("3. Checking Notification History...")
print("=" * 70)

notif_response = supabase.table("notifications")\
    .select("*")\
    .order("created_at", desc=True)\
    .limit(10)\
    .execute()

print(f"\nLast 10 notifications:")
for notif in notif_response.data:
    print(f"   - {notif.get('type')}: {notif.get('message')[:60]}...")
    print(f"     Created: {notif.get('created_at')}")

print("\n" + "=" * 70)
