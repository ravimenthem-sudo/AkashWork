from typing import List, Dict
import logging

from models.schemas import UserRole, SmartButton, ButtonType, PageContext

logger = logging.getLogger(__name__)

# Smart button definitions: role × page matrix
SMART_BUTTONS_MATRIX = {
    # EMPLOYEE BUTTONS
    ("employee", "tasks"): [
        {"id": "emp_tasks_high", "label": "Show my high priority tasks", "type": "action", "icon": "AlertCircle", "action_type": "filter"},
        {"id": "emp_tasks_blocked", "label": "What tasks are blocked?", "type": "query", "icon": "Ban", "rag_required": True},
        {"id": "emp_tasks_explain", "label": "Explain my current task", "type": "query", "icon": "HelpCircle", "rag_required": True, "llm_required": True},
        {"id": "emp_tasks_next", "label": "What should I do next?", "type": "query", "icon": "ArrowRight", "rag_required": True, "llm_required": True}
    ],
    
    ("employee", "leaves"): [
        {"id": "emp_leave_balance", "label": "Check my leave balance", "type": "action", "icon": "Calendar", "action_type": "query"},
        {"id": "emp_leave_apply", "label": "How to apply for leave?", "type": "query", "icon": "FileText", "rag_required": True},
        {"id": "emp_leave_status", "label": "Leave approval status", "type": "action", "icon": "Clock", "action_type": "query"},
        {"id": "emp_leave_policy", "label": "Leave policy summary", "type": "query", "icon": "BookOpen", "rag_required": True, "llm_required": True}
    ],
    
    ("employee", "performance"): [
        {"id": "emp_perf_ratings", "label": "View my ratings", "type": "action", "icon": "Star", "action_type": "navigate"},
        {"id": "emp_perf_criteria", "label": "Explain rating criteria", "type": "query", "icon": "Info", "rag_required": True, "llm_required": True},
        {"id": "emp_perf_tips", "label": "Performance improvement tips", "type": "query", "icon": "TrendingUp", "rag_required": True, "llm_required": True},
        {"id": "emp_perf_feedback", "label": "Feedback history", "type": "action", "icon": "MessageSquare", "action_type": "navigate"}
    ],
    
    # MANAGER BUTTONS
    ("manager", "tasks"): [
        {"id": "mgr_tasks_all", "label": "Show all team tasks", "type": "action", "icon": "List", "action_type": "filter", "permission_level": 3},
        {"id": "mgr_tasks_overdue", "label": "Who has overdue tasks?", "type": "action", "icon": "AlertTriangle", "action_type": "filter", "permission_level": 3},
        {"id": "mgr_tasks_dist", "label": "Task distribution analysis", "type": "query", "icon": "PieChart", "rag_required": False, "llm_required": True, "permission_level": 3},
        {"id": "mgr_tasks_reassign", "label": "Reassign tasks", "type": "navigation", "icon": "Users", "action_type": "navigate", "permission_level": 3}
    ],
    
    ("manager", "performance"): [
        {"id": "mgr_perf_reviews", "label": "Pending reviews", "type": "action", "icon": "Clock", "action_type": "filter", "permission_level": 3},
        {"id": "mgr_perf_summary", "label": "Team performance summary", "type": "query", "icon": "BarChart", "rag_required": False, "llm_required": True, "permission_level": 3},
        {"id": "mgr_perf_criteria", "label": "Rating criteria guide", "type": "query", "icon": "BookOpen", "rag_required": True, "llm_required": True, "permission_level": 3},
        {"id": "mgr_perf_schedule", "label": "Schedule review cycle", "type": "action", "icon": "Calendar", "action_type": "navigate", "permission_level": 3}
    ],
    
    ("manager", "leaves"): [
        {"id": "mgr_leave_approve", "label": "Approve pending leaves", "type": "action", "icon": "CheckCircle", "action_type": "navigate", "permission_level": 3},
        {"id": "mgr_leave_calendar", "label": "Team leave calendar", "type": "action", "icon": "Calendar", "action_type": "navigate", "permission_level": 3},
        {"id": "mgr_leave_policy", "label": "Leave policy details", "type": "query", "icon": "FileText", "rag_required": True, "permission_level": 3},
        {"id": "mgr_leave_escalation", "label": "Leave escalation process", "type": "query", "icon": "TrendingUp", "rag_required": True, "llm_required": True, "permission_level": 3}
    ],
    
    # EXECUTIVE BUTTONS
    ("executive", "dashboard"): [
        {"id": "exec_dash_metrics", "label": "Company metrics summary", "type": "query", "icon": "Activity", "rag_required": False, "llm_required": True, "permission_level": 4},
        {"id": "exec_dash_budget", "label": "Budget utilization", "type": "action", "icon": "DollarSign", "action_type": "navigate", "permission_level": 4},
        {"id": "exec_dash_headcount", "label": "Headcount analysis", "type": "query", "icon": "Users", "rag_required": False, "llm_required": True, "permission_level": 4},
        {"id": "exec_dash_initiatives", "label": "Strategic initiatives", "type": "query", "icon": "Target", "rag_required": True, "llm_required": True, "permission_level": 4}
    ],
    
    ("executive", "projects"): [
        {"id": "exec_proj_health", "label": "Project health status", "type": "query", "icon": "Activity", "rag_required": False, "llm_required": True, "permission_level": 4},
        {"id": "exec_proj_resources", "label": "Resource allocation", "type": "action", "icon": "Users", "action_type": "navigate", "permission_level": 4},
        {"id": "exec_proj_budget", "label": "Budget vs actual", "type": "query", "icon": "TrendingUp", "rag_required": False, "llm_required": True, "permission_level": 4},
        {"id": "exec_proj_risks", "label": "Project risks overview", "type": "query", "icon": "AlertTriangle", "rag_required": True, "llm_required": True, "permission_level": 4}
    ],
    
    # TEAM LEAD BUTTONS
    ("team_lead", "tasks"): [
        {"id": "lead_tasks_team", "label": "Team task overview", "type": "action", "icon": "List", "action_type": "filter", "permission_level": 2},
        {"id": "lead_tasks_blocked", "label": "Blocked tasks report", "type": "action", "icon": "Ban", "action_type": "filter", "permission_level": 2},
        {"id": "lead_tasks_help", "label": "Help team with tasks", "type": "query", "icon": "HelpCircle", "rag_required": True, "llm_required": True, "permission_level": 2},
        {"id": "lead_tasks_prioritize", "label": "Prioritization guide", "type": "query", "icon": "ArrowUp", "rag_required": True, "llm_required": True, "permission_level": 2}
    ],
}

# Default fallback buttons
DEFAULT_BUTTONS = [
    {"id": "default_help", "label": "How can I help you?", "type": "query", "icon": "HelpCircle", "rag_required": True},
    {"id": "default_docs", "label": "Search documents", "type": "navigation", "icon": "Search", "action_type": "navigate"},
    {"id": "default_policies", "label": "View policies", "type": "navigation", "icon": "FileText", "action_type": "navigate"},
    {"id": "default_support", "label": "Contact support", "type": "navigation", "icon": "MessageCircle", "action_type": "navigate"}
]

class SmartButtonGenerator:
    """Generate context-aware smart buttons based on role and page"""
    
    def generate_buttons(self, context: PageContext) -> List[SmartButton]:
        """
        Generate 4 smart buttons for given context
        
        Args:
            context: Page context with role and module
            
        Returns:
            List of 4 SmartButton objects
        """
        logger.info(f"Generating buttons for {context.role} on {context.module}")
        
        # Look up buttons in matrix
        key = (context.role.value, context.module)
        button_defs = SMART_BUTTONS_MATRIX.get(key, DEFAULT_BUTTONS)
        
        # Convert to SmartButton objects
        buttons = []
        for btn_def in button_defs[:4]:  # Take first 4
            buttons.append(SmartButton(
                id=btn_def["id"],
                label=btn_def["label"],
                type=ButtonType(btn_def["type"]),
                icon=btn_def["icon"],
                action_type=btn_def.get("action_type"),
                rag_required=btn_def.get("rag_required", False),
                llm_required=btn_def.get("llm_required", False),
                permission_level=btn_def.get("permission_level", 1)
            ))
        
        # If less than 4, pad with defaults
        while len(buttons) < 4:
            buttons.append(SmartButton(
                id=f"default_{len(buttons)}",
                label=DEFAULT_BUTTONS[len(buttons) % len(DEFAULT_BUTTONS)]["label"],
                type=ButtonType.query,
                icon=DEFAULT_BUTTONS[len(buttons) % len(DEFAULT_BUTTONS)]["icon"]
            ))
        
        logger.info(f"Generated {len(buttons)} buttons")
        return buttons

# Global instance
_button_generator = None

def get_button_generator() -> SmartButtonGenerator:
    """Get or create singleton button generator"""
    global _button_generator
    if _button_generator is None:
        _button_generator = SmartButtonGenerator()
    return _button_generator
