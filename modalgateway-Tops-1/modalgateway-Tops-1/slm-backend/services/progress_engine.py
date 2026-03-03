import logging
from typing import Dict, Any, Tuple
import datetime

logger = logging.getLogger(__name__)

class ProgressEngine:
    """
    SLM Progress Calculation Engine (The Judge)
    Responsible for validating task progress, detecting stagnation risks, 
    and ensuring completion signals are supported by evidence (work done).
    """

    def __init__(self, llm_gateway=None):
        self.llm_gateway = llm_gateway

    def validate_completion(self, task: Dict[str, Any], user_comment: str) -> Tuple[bool, str, float]:
        """
        Validates if a task can be marked as completed based on semantic analysis.
        
        Args:
            task: Task dictionary (title, sub_state, etc.)
            user_comment: The comment provided by the user when closing the task.
        
        Returns:
            (is_approved: bool, reason: str, confidence: float)
        """
        if not user_comment or len(user_comment.strip()) < 10:
            return False, "Completion requires a detailed comment explaining what was done.", 0.9

        # Heuristic Checks
        bad_patterns = ["done", "fixed", "completed", "ok"]
        if user_comment.lower().strip() in bad_patterns:
            return False, "Comment is too vague. Please describe the changes made.", 0.85

        # If LLM is connected, use it for deeper validation (Simulated for now if None)
        if self.llm_gateway:
            # Future: Call LLM to compare task.description vs user_comment
            pass

        return True, "Completion evidence looks valid.", 0.7

    def calculate_risk(self, task: Dict[str, Any]) -> str:
        """
        Calculates the risk level of a task based on velocity.
        """
        now = datetime.datetime.now()
        updated_at_str = task.get("updated_at")
        
        # Determine risk based on stagnation
        if updated_at_str:
            try:
                # Handle ISO format with potential Z
                updated_at = datetime.datetime.fromisoformat(updated_at_str.replace("Z", "+00:00"))
                days_stagnant = (now - updated_at.replace(tzinfo=None)).days
                
                if days_stagnant > 7:
                    return "HIGH_RISK"
                elif days_stagnant > 3:
                    return "MEDIUM_RISK"
            except Exception as e:
                logger.warning(f"Error parsing date: {e}")
        
        return "LOW_RISK"

    def calculate_percentage(self, lifecycle_state: str, sub_state: str) -> int:
        """
        Calculates progress percentage based on R-D-B-A-D lifecycle.
        Feature 4 from PDF.
        """
        mapping = {
            "requirement_refiner": 20,
            "design_guidance": 40,
            "build_guidance": 60,
            "acceptance_criteria": 80,
            "deployment": 100
        }
        
        base_pct = mapping.get(lifecycle_state.lower(), 0)
        
        # Adjust based on sub_state
        if sub_state == "pending_validation":
            base_pct -= 5 # Slightly less if waiting for approval
        elif sub_state == "rejected":
            base_pct -= 10 # Penalty for rejection
            
        return max(0, min(100, base_pct))

# Global Instance
_progress_engine = None

def get_progress_engine():
    global _progress_engine
    if _progress_engine is None:
        _progress_engine = ProgressEngine()
    return _progress_engine
