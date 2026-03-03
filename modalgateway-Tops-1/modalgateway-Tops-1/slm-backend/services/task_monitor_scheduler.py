"""
Task Monitor Scheduler - Background job to run task monitoring

This module provides a ready-to-use scheduler that runs the task monitoring
at regular intervals and sends proactive reminders.

Usage:
    python task_monitor_scheduler.py
    
Or integrate with your existing scheduler (APScheduler, Celery, etc.)
"""

import os
import sys
import time
from datetime import datetime
from typing import List, Dict

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.task_monitor import TaskMonitor, NotificationService, TaskMonitorConfig


class TaskMonitorScheduler:
    """
    Scheduler that runs task monitoring at regular intervals
    """
    
    def __init__(self, supabase_client, interval_hours: int = 2):
        """
        Args:
            supabase_client: Your Supabase client instance
            interval_hours: How often to run monitoring (default: 2 hours)
        """
        self.monitor = TaskMonitor()
        self.notifier = NotificationService(supabase_client)
        self.supabase = supabase_client
        self.interval_hours = interval_hours
        self.last_run = None
    
    def fetch_active_tasks(self) -> List[Dict]:
        """
        Fetch all active tasks that need monitoring.
        
        Returns:
            List of task dictionaries
        """
        try:
            # Fetch tasks that are not completed/done/archived
            response = self.supabase.table("tasks")\
                .select("*")\
                .not_.in_("status", ["completed", "done", "archived"])\
                .execute()
            
            return response.data if response.data else []
        except Exception as e:
            print(f"Error fetching tasks: {e}")
            return []
    
    def run_monitoring_cycle(self) -> Dict[str, int]:
        """
        Run one complete monitoring cycle.
        
        Returns:
            Statistics dict with counts
        """
        print(f"\n{'='*60}")
        print(f"Task Monitoring Cycle - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}")
        
        # Fetch active tasks
        tasks = self.fetch_active_tasks()
        print(f"[MONITOR] Fetched {len(tasks)} active tasks")
        
        if not tasks:
            print("[MONITOR] No active tasks to monitor")
            return {"tasks_checked": 0, "reminders_sent": 0}
        
        # Check tasks for reminders
        reminders = self.monitor.batch_check_tasks(tasks)
        print(f"[MONITOR] Generated {len(reminders)} reminders")
        
        # Send notifications
        sent_count = 0
        failed_count = 0
        
        for reminder in reminders:
            try:
                success = self.notifier.send_reminder(reminder)
                if success:
                    sent_count += 1
                    print(f"  [OK] Sent {reminder['reminder_type']} for task {reminder['task_id'][:8]}...")
                else:
                    failed_count += 1
                    print(f"  [FAIL] Failed to send reminder for task {reminder['task_id'][:8]}...")
            except Exception as e:
                failed_count += 1
                print(f"  [ERROR] Error sending reminder: {e}")
        
        # Summary
        print(f"\n[SUMMARY]:")
        print(f"  - Tasks checked: {len(tasks)}")
        print(f"  - Reminders generated: {len(reminders)}")
        print(f"  - Notifications sent: {sent_count}")
        if failed_count > 0:
            print(f"  - Failed: {failed_count}")
        
        self.last_run = datetime.now()
        
        return {
            "tasks_checked": len(tasks),
            "reminders_generated": len(reminders),
            "reminders_sent": sent_count,
            "reminders_failed": failed_count
        }
    
    def start_continuous(self):
        """
        Start continuous monitoring loop (runs forever).
        Use this for standalone deployment.
        """
        print(f"[MONITOR] Starting Task Monitor Scheduler")
        print(f"   Interval: Every {self.interval_hours} hours")
        print(f"   Press Ctrl+C to stop\n")
        
        try:
            while True:
                self.run_monitoring_cycle()
                
                # Sleep until next cycle
                sleep_seconds = self.interval_hours * 3600
                next_run = datetime.now().timestamp() + sleep_seconds
                next_run_str = datetime.fromtimestamp(next_run).strftime('%Y-%m-%d %H:%M:%S')
                
                print(f"\n[MONITOR] Sleeping until {next_run_str}")
                print(f"{'='*60}\n")
                
                time.sleep(sleep_seconds)
                
        except KeyboardInterrupt:
            print("\n\n[MONITOR] Scheduler stopped by user")
        except Exception as e:
            print(f"\n\n[ERROR] Scheduler error: {e}")
            raise


# ==========================================
# INTEGRATION EXAMPLES
# ==========================================

def example_standalone_runner():
    """
    Example: Run as standalone process
    """
    # Import your Supabase client
    from server import supabase  # Adjust import based on your setup
    
    # Create and start scheduler
    scheduler = TaskMonitorScheduler(supabase, interval_hours=2)
    scheduler.start_continuous()


def example_single_run():
    """
    Example: Run once (for cron jobs)
    """
    from server import supabase
    
    scheduler = TaskMonitorScheduler(supabase)
    stats = scheduler.run_monitoring_cycle()
    
    print(f"\nMonitoring complete: {stats}")


def example_apscheduler_integration():
    """
    Example: Integrate with APScheduler
    """
    from apscheduler.schedulers.background import BackgroundScheduler
    from server import supabase
    
    scheduler = TaskMonitorScheduler(supabase)
    
    # Create APScheduler instance
    background_scheduler = BackgroundScheduler()
    
    # Schedule monitoring every 2 hours
    background_scheduler.add_job(
        scheduler.run_monitoring_cycle,
        'interval',
        hours=2,
        id='task_monitoring',
        name='Task Lifecycle Monitoring'
    )
    
    background_scheduler.start()
    
    print("Task monitoring scheduled with APScheduler")
    
    # Keep the script running
    try:
        while True:
            time.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        background_scheduler.shutdown()


def example_fastapi_startup():
    """
    Example: Start with FastAPI application
    """
    from fastapi import FastAPI
    from contextlib import asynccontextmanager
    import threading
    from server import supabase
    
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Startup: Start monitoring in background thread
        scheduler = TaskMonitorScheduler(supabase, interval_hours=2)
        
        def run_scheduler():
            scheduler.start_continuous()
        
        monitor_thread = threading.Thread(target=run_scheduler, daemon=True)
        monitor_thread.start()
        
        print("[OK] Task monitoring started in background")
        
        yield
        
        # Shutdown
        print("[OK] Task monitoring stopped")
    
    app = FastAPI(lifespan=lifespan)


if __name__ == "__main__":
    """
    Run this file directly to start standalone monitoring
    """
    print("Task Monitor Scheduler\n")
    print("Choose mode:")
    print("1. Continuous (runs every 2 hours)")
    print("2. Single run (for testing)")
    
    choice = input("\nEnter choice (1 or 2): ").strip()
    
    if choice == "1":
        example_standalone_runner()
    elif choice == "2":
        example_single_run()
    else:
        print("Invalid choice")
