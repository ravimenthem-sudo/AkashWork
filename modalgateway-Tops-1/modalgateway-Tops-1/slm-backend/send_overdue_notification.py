"""
Send overdue notification for the user's task
"""
import sys
sys.path.insert(0, r'C:\Users\DELL\Desktop\T-ops\Talent Ops\modalgateway\slm-backend')

from server import supabase
from services.task_monitor import TaskMonitor, NotificationService

print("Sending OVERDUE notification for your task...")

# Fetch the SLM Chat Bot Development task
task_response = supabase.table("tasks")\
    .select("*")\
    .ilike("title", "%SLM%Chat%")\
    .execute()

if task_response.data:
    monitor = TaskMonitor()
    notifier = NotificationService(supabase)
    
    for task in task_response.data:
        print(f"\nTask: {task['title']}")
        print(f"Due: {task['due_date']}")
        print(f"Assigned to: {task['assigned_to']}")
        
        reminder = monitor.check_task(task)
        
        if reminder:
            print(f"\nSending notification...")
            print(f"Type: {reminder['reminder_type']}")
            print(f"Urgency: {reminder['urgency']}")
            
            success = notifier.send_reminder(reminder)
            
            if success:
                print("SUCCESS! Notification sent to database!")
                print("\nGo check:")
                print("1. Supabase -> notifications table")
                print("2. Your frontend notification bell")
            else:
                print("Failed to send notification")
        else:
            print("No reminder generated (unexpected!)")
else:
    print("Task not found!")
