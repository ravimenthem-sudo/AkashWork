import re
from typing import Optional, Dict, List
import logging

logger = logging.getLogger(__name__)

# Allowed scopes for queries
ALLOWED_SCOPES = {
    "hr_policies", "project_docs", "tasks", "performance",
    "leaves", "payroll", "announcements", "sops", 
    "documents", "employees", "team"
}

# Out-of-scope patterns
OUT_OF_SCOPE_PATTERNS = [
    r"weather",
    r"news",
    r"stock market",
    r"sports",
    r"recipe",
    r"movie",
    r"song",
    r"game"
]

# Prompt injection patterns
INJECTION_PATTERNS = [
    r"ignore\s+(previous|all|above)\s+instructions?",
    r"you\s+are\s+now",
    r"new\s+instructions?",
    r"system\s+prompt",
    r"<\|.*?\|>",  # Special tokens
    r"sudo",
    r"admin\s+mode",
    r"escalate\s+privileges",
    r"role\s*:\s*system",
    r"forget\s+(everything|all)",
    r"disregard\s+(previous|above)"
]

class GuardrailService:
    """Guardrails for scope validation and prompt injection detection"""
    
    def __init__(self, min_confidence: float = 0.50):
        self.min_confidence = min_confidence
        self.injection_regex = re.compile(
            '|'.join(INJECTION_PATTERNS),
            re.IGNORECASE | re.MULTILINE
        )
        self.out_of_scope_regex = re.compile(
            '|'.join(OUT_OF_SCOPE_PATTERNS),
            re.IGNORECASE
        )
    
    def validate_scope(self, query: str, page_module: str) -> Dict[str, any]:
        """
        Validate if query is in scope
        
        Returns:
            {"valid": bool, "reason": str}
        """
        query_lower = query.lower()
        
        # Check for obvious out-of-scope topics
        if self.out_of_scope_regex.search(query_lower):
            return {
                "valid": False,
                "reason": "Query is about topics outside Talent Ops scope"
            }
        
        # Check if query length is reasonable
        if len(query) < 3:
            return {
                "valid": False,
                "reason": "Query too short"
            }
        
        if len(query) > 1000:
            return {
                "valid": False,
                "reason": "Query too long (max 1000 characters)"
            }
        
        # Basic intent extraction (keywords)
        # Check if query relates to allowed modules
        has_relevant_keyword = any(
            scope in query_lower for scope in ALLOWED_SCOPES
        )
        
        # Also check page module
        if page_module.lower() in query_lower or has_relevant_keyword:
            return {"valid": True, "reason": "In scope"}
        
        # If no obvious keywords, allow (let RAG determine relevance)
        return {"valid": True, "reason": "Passed initial validation"}
    
    def detect_injection(self, text: str) -> Dict[str, any]:
        """
        Detect prompt injection attempts
        
        Returns:
            {"is_injection": bool, "patterns_found": List[str]}
        """
        matches = self.injection_regex.findall(text)
        
        if matches:
            logger.warning(f"Prompt injection detected: {matches}")
            return {
                "is_injection": True,
                "patterns_found": matches
            }
        
        return {
            "is_injection": False,
            "patterns_found": []
        }
    
    def validate_confidence(self, confidence: float) -> bool:
        """Check if confidence meets threshold"""
        return confidence >= self.min_confidence
    
    def should_answer(
        self,
        confidence: float,
        num_chunks: int,
        unique_docs: int
    ) -> Dict[str, any]:
        """
        Determine if answer should be provided
        
        Args:
            confidence: Confidence score
            num_chunks: Number of retrieved chunks
            unique_docs: Number of unique source documents
            
        Returns:
            {"should_answer": bool, "reason": str}
        """
        # Confidence too low
        if confidence < self.min_confidence:
            return {
                "should_answer": False,
                "reason": f"Confidence {confidence:.2f} below threshold {self.min_confidence}"
            }
        
        return {"should_answer": True, "reason": "Passed confidence gating"}

# Global instance
_guardrails = None

def get_guardrails() -> GuardrailService:
    """Get or create singleton guardrail service"""
    global _guardrails
    if _guardrails is None:
        _guardrails = GuardrailService()
    return _guardrails
