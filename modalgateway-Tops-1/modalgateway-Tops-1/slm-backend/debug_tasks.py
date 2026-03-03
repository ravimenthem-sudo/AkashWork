from server import supabase
import json

def debug_tasks():
    print("--- COMPARING VISIBLE VS NEW TASKS ---")
    
    # 1. Get the task "UI" (Visible in screenshot)
    res = supabase.table("tasks").select("*").eq("title", "UI").execute()
    if res.data:
        print("\nVisible Task 'UI':")
        print(json.dumps(res.data[0], indent=2))
    
    # 2. Get the new task "Complete API Documentation"
    res = supabase.table("tasks").select("*").eq("title", "Complete API Documentation").execute()
    if res.data:
        print("\nNew Task 'Complete API Documentation':")
        print(json.dumps(res.data[0], indent=2))

if __name__ == "__main__":
    debug_tasks()
