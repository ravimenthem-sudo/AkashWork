"""
RBAC (Role-Based Access Control) Rules for TalentOps
Defines permissions, supported actions, role hierarchy, and module redirections
"""

# Role hierarchy (higher roles inherit permissions from lower roles)
ROLE_HIERARCHY = {
    "executive": 4,
    "manager": 3,
    "team_lead": 2,
    "employee": 1
}

# Action Registry for AI Intent Classification
# This serves as the single source of truth for the AI's "brain"
ACTION_REGISTRY = {
    "get_tasks": {
        "description": "Retrieve tasks for a user, team, or project.",
        "parameters": {"filter": "string (pending, my, team, completed, overdue)"}
    },
    "assign_task": {
        "description": "Assign a task to an employee.",
        "parameters": {"employee_name": "string", "task_description": "string", "priority": "string"}
    },
    "update_task_status": {
        "description": "Update the status of an existing task.",
        "parameters": {"task_id": "string", "status": "string (completed, in_progress, pending)"}
    },
    "create_task": {
        "description": "Create a new task.",
        "parameters": {"title": "string", "description": "string", "assigned_to": "string"}
    },
    "delete_task": {
        "description": "Delete a specific task.",
        "parameters": {"task_id": "string"}
    },
    "get_attendance": {
        "description": "View attendance records for self or team.",
        "parameters": {"date": "string (YYYY-MM-DD)", "period": "string (today, week, month)"}
    },
    "clock_in": {
        "description": "Perform clock-in action for attendance.",
        "parameters": {}
    },
    "clock_out": {
        "description": "Perform clock-out action for attendance.",
        "parameters": {}
    },
    "mark_attendance": {
        "description": "Manually mark attendance for an employee.",
        "parameters": {"employee_name": "string", "date": "string", "status": "string"}
    },
    "get_pending_leaves": {
        "description": "View list of pending leave requests waiting for approval.",
        "parameters": {"team": "boolean"}
    },
    "get_leave_balance": {
        "description": "Check remaining leave days and quota.",
        "parameters": {}
    },
    "apply_leave": {
        "description": "Submit a new leave request.",
        "parameters": {"type": "string", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "reason": "string"}
    },
    "approve_leave": {
        "description": "Approve a pending leave request.",
        "parameters": {"employee_name": "string"}
    },
    "reject_leave": {
        "description": "Reject a pending leave request.",
        "parameters": {"employee_name": "string", "reason": "string"}
    },
    "get_team_members": {
        "description": "List members of a team or project.",
        "parameters": {"project_id": "string"}
    },
    "get_org_hierarchy": {
        "description": "View organization structure and reporting lines.",
        "parameters": {}
    },
    "get_project_hierarchy": {
        "description": "View project-specific hierarchy and teams.",
        "parameters": {}
    },
    "get_notifications": {
        "description": "LIST notifications directly in the chat window. Use this for 'show notifications', 'what are my alerts', etc. NEVER navigate for these queries.",
        "parameters": {}
    },
    "get_project_documents": {
        "description": "LIST available documents and their @tags directly in the chat window. Use this for 'what documents are available', 'show project docs', etc. NEVER navigate for these queries.",
        "parameters": {}
    },
    "get_hiring_overview": {
        "description": "Fetch a summary of recruitment status to show in chat.",
        "parameters": {}
    },
    "get_jobs": {
        "description": "List open job positions in the chat.",
        "parameters": {"department": "string"}
    },
    "get_candidates": {
        "description": "List candidates in the chat.",
        "parameters": {"job_title": "string"}
    },
    "get_analytics": {
        "description": "Show insights and trends in the chat window.",
        "parameters": {"metric": "string", "time_period": "string"}
    },
    "navigate_to_module": {
        "description": "ONLY use this when the user EXPLICITLY says 'go to [page]', 'redirect me to', or 'open the [module] page'. Do NOT use for 'show me' or 'what are' queries.",
        "parameters": {"module": "string", "route": "string"}
    },
    "chat": {
        "description": "General conversation or context-specific helpful response.",
        "parameters": {}
    },
    "greeting": {
        "description": "Professional greeting to the user.",
        "parameters": {}
    }
}

# Supported actions across the system
SUPPORTED_ACTIONS = list(ACTION_REGISTRY.keys())

# Role-based access control rules
RBAC_RULES = {
    "employee": [
        "get_tasks", "update_task_status", 
        "get_attendance", "clock_in", "clock_out", 
        "get_leave_balance", "apply_leave", 
        "chat", "greeting", "navigate_to_module"
    ],
    "team_lead": [
        "get_tasks", "update_task_status", "assign_task", 
        "get_attendance", "clock_in", "clock_out", 
        "get_leave_balance", "apply_leave", "get_pending_leaves", "approve_leave", "reject_leave", 
        "chat", "greeting", "navigate_to_module"
    ],
    "manager": [
        "get_tasks", "update_task_status", "assign_task", "create_task", "delete_task",
        "get_attendance", "clock_in", "clock_out", "mark_attendance",
        "get_pending_leaves", "get_leave_balance", "apply_leave", "approve_leave", "reject_leave",
        "get_team_members", "get_org_hierarchy", "get_project_hierarchy",
        "get_project_documents", "upload_document", "delete_document",
        "get_projects", "update_project",
        "get_hiring_overview", "get_jobs", "get_candidates",
        "chat", "greeting", "navigate_to_module"
    ],
    "executive": [
        "get_tasks", "assign_task", "update_task_status", "create_task", "delete_task",
        "get_attendance", "clock_in", "clock_out", "mark_attendance",
        "get_pending_leaves", "get_leave_balance", "apply_leave", "approve_leave", "reject_leave",
        "get_team_members", "get_org_hierarchy", "get_project_hierarchy",
        "post_announcement", "create_event", "update_event", "delete_event", "get_notifications",
        "get_project_documents", "upload_document", "delete_document",
        "create_project", "update_project", "get_projects", "add_project_member", "remove_project_member",
        "get_hiring_overview", "get_jobs", "get_candidates",
        "chat", "greeting", "navigate_to_module"
    ]
}


def check_permission(role: str, action: str) -> bool:
    """
    Check if a role has permission to perform an action
    
    Args:
        role: User's role (employee, team_lead, manager, executive)
        action: Action to check permission for
        
    Returns:
        bool: True if role has permission, False otherwise
    """
    role_lower = role.lower()
    
    if role_lower not in RBAC_RULES:
        return False
    
    return action in RBAC_RULES[role_lower]


def get_role_level(role: str) -> int:
    """
    Get the hierarchy level of a role
    
    Args:
        role: User's role
        
    Returns:
        int: Hierarchy level (higher number = more permissions)
    """
    return ROLE_HIERARCHY.get(role.lower(), 0)
