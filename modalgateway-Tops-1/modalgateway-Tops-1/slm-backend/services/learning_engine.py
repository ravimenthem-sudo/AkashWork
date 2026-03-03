import logging
import re
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

class LearningEngine:
    """
    SLM Learning Capture Framework (The Scribe)
    Responsible for extracting actionable learnings from unstructured 
    conversations and project updates.
    """

    def __init__(self, llm_gateway=None):
        self.llm_gateway = llm_gateway
        self.learnings = [] # In-memory store (simulating DB for now)

    def extract_learning(self, text: str, domain: str = "general") -> Dict[str, Any]:
        """
        Analyzes text to see if it contains a 'Learning' or 'Post-Mortem' insight.
        """
        # Heuristic Triggers
        triggers = [
            "learned that", "realized that", "root cause was", 
            "future reference", "don't forget to", "solution was",
            "fix was"
        ]
        
        context_lower = text.lower()
        if any(t in context_lower for t in triggers):
            # Extract the insight (Simulated extraction)
            # In production, this would use LLM extraction
            
            insight = self._clean_insight(text)
            learning_record = {
                "domain": domain,
                "insight": insight,
                "confidence": 0.85, # High because heuristic matched
                "tags": ["auto-captured"]
            }
            self.learnings.append(learning_record)
            return learning_record
        
        return None

    def _clean_insight(self, text: str) -> str:
        """Helper to try and isolate the learning part"""
        # Simple split logic for demo
        for split_phrase in ["learned that", "realized that", "root cause was"]:
            if split_phrase in text.lower():
                parts = re.split(split_phrase, text, flags=re.IGNORECASE)
                if len(parts) > 1:
                    return parts[1].strip().capitalize()
        return text

    def query_relevant_learnings(self, topic: str) -> List[Dict[str, Any]]:
        """
        Returns learnings relevant to a topic.
        """
        # Simple keyword match for now
        results = [
            l for l in self.learnings 
            if any(w in l["insight"].lower() for w in topic.lower().split())
        ]
        return results

# Global Instance
_learning_engine = None

def get_learning_engine():
    global _learning_engine
    if _learning_engine is None:
        _learning_engine = LearningEngine()
    return _learning_engine
