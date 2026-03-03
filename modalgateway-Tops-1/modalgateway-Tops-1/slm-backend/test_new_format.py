"""
Test the new date format for overdue notifications
"""
import sys
sys.path.insert(0, r'C:\Users\DELL\Desktop\T-ops\Talent Ops\modalgateway\slm-backend')

from server import supabase
from services.task_monitor import TaskMonitor, NotificationService

print("Testing new overdue notification format...")
print("=" * 60)

# Fetch the task
task_response = supabase.table("tasks")\
    .select("*")\
    .ilike("title", "%SLM%Chat%")\
    .limit(1)\
    .execute()

if task_response.data:
    monitor = TaskMonitor()
    notifier = NotificationService(supabase)
    
    task = task_response.data[0]
    print(f"\nTask: {task['title']}")
    print(f"Due Date: {task['due_date']}")
    
    reminder = monitor.check_task(task)
    
    if reminder:
        print(f"\nNew Message Format:")
        print(f"{reminder['message']}")
        print(f"\nSending to database...")
        
        success = notifier.send_reminder(reminder)
        
        if success:
            print("\nSUCCESS! Check your notifications now!")
            print("\nThe message will show:")
            print(f"  '{reminder['message']}'")
        else:
            print("Failed to send")
    else:
        print("No reminder generated")
else:
    print("Task not found")
