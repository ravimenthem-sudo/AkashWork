"""
Quick test to verify task monitor is working and create a test notification
"""
import sys
sys.path.insert(0, r'C:\Users\DELL\Desktop\T-ops\Talent Ops\modalgateway\slm-backend')

from server import supabase
from services.task_monitor import TaskMonitor, NotificationService
from datetime import datetime, timedelta

print("=" * 60)
print("Task Monitor Test")
print("=" * 60)

# Initialize
monitor = TaskMonitor()
notifier = NotificationService(supabase)

print("\n1. Fetching active tasks...")
tasks_response = supabase.table("tasks").select("*").neq("status", "completed").limit(10).execute()
tasks = tasks_response.data

print(f"   Found {len(tasks)} active tasks")

if tasks:
    print("\n2. Checking for reminders...")
    reminders = monitor.batch_check_tasks(tasks)
    
    print(f"   Generated {len(reminders)} reminders")
    
    if reminders:
        print("\n3. Sending test notifications...")
        for reminder in reminders:
            success = notifier.send_reminder(reminder)
            if success:
                print(f"   ✓ Sent {reminder['reminder_type']} notification")
            else:
                print(f"   ✗ Failed to send notification")
    else:
        print("\n   No reminders needed (tasks are progressing normally)")
        print("\n   Creating a test notification to show you where to look...")
        
        # Create a test notification
        test_notification = {
            "task_id": tasks[0]["id"] if tasks else "test-task-id",
            "assigned_to": tasks[0]["assigned_to"] if tasks else None,
            "reminder_type": "not_started",
            "message": "🔔 TEST: This is a sample task reminder notification. The task monitor is working!",
            "urgency": 2
        }
        
        if test_notification["assigned_to"]:
            notifier.send_reminder(test_notification)
            print(f"   ✓ Test notification created!")

print("\n" + "=" * 60)
print("WHERE TO SEE NOTIFICATIONS:")
print("=" * 60)
print("\n📍 Option 1: Supabase Dashboard")
print("   1. Go to https://supabase.com")
print("   2. Open your project")
print("   3. Click 'Table Editor' → 'notifications'")
print("   4. You should see new rows!")

print("\n📍 Option 2: Your Frontend App")
print("   1. Open your TalentOps app in browser")
print("   2. Look for the notification bell 🔔 icon")
print("   3. Click it to see notifications")

print("\n" + "=" * 60)
