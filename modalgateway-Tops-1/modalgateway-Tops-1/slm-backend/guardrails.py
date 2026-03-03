# guardrails.py - Enterprise-Grade AI Safety Controls
# Ported for Unified TalentOps Backend

import re
import json
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any

# ============================================================
# CONSTANTS
# ============================================================

MAX_INPUT_LENGTH = 500
MAX_OUTPUT_RECORDS = 10

# SQL Injection patterns
SQL_INJECTION_PATTERNS = [
    r";\s*DROP\s+",
    r";\s*DELETE\s+",
    r";\s*TRUNCATE\s+",
    r";\s*UPDATE\s+.*SET\s+",
    r";\s*INSERT\s+",
    r"--\s*$",
    r"\/\*.*\*\/",
    r"'\s*OR\s+'1'\s*=\s*'1",
    r"'\s*OR\s+1\s*=\s*1",
    r"UNION\s+SELECT",
]

# Prompt injection patterns
PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+(previous|all|your)\s+(instructions?|rules?|prompts?)",
    r"forget\s+(everything|your|all)",
    r"you\s+are\s+now\s+a?",
    r"new\s+rule\s*:",
    r"system\s*:\s*",
    r"override\s+(security|permission|access)",
    r"pretend\s+(you|to\s+be)",
    r"act\s+as\s+(if|a)",
    r"tell\s+me\s+(the|your)\s+(password|secret|key)",
    r"show\s+(all|every|complete)\s+(data|records?|employees?|salaries?)",
    r"debug\s+mode",
    r"test\s+mode",
    r"admin\s+mode",
    r"bypass\s+(security|permission|check)",
]

# Off-topic keywords
OFF_TOPIC_PATTERNS = [
    r"weather\s+(today|tomorrow|forecast)",
    r"what\s+is\s+the\s+(capital|president|population|meaning|distance|height|weight)",
    r"tell\s+me\s+a\s+joke",
    r"who\s+won\s+(the|last)",
    r"recipe\s+for",
    r"how\s+to\s+cook",
    r"movie\s+recommendation",
    r"what\s+do\s+you\s+think\s+about",
    r"political\s+opinion",
    r"stock\s+price",
    r"bitcoin|crypto",
    r"who\s+is\s+(the\s+)?(actor|actress|singer|celebrity)",
    r"write\s+a\s+(poem|song|story)\s+about",
    r"solve\s+this\s+math",
    r"how\s+do\s+i\s+make\s+a\s+cake",
]

# Sensitive fields that should NEVER be exposed
SENSITIVE_FIELDS = [
    'password', 'password_hash', 'auth_token', 'access_token', 'refresh_token',
    'secret', 'api_key', 'private_key', 'ssn', 'social_security', 'aadhaar',
    'bank_account', 'account_number', 'routing_number', 'credit_card', 'cvv',
    'salary', 'compensation', 'pay', 'wage', 'bonus', 'medical', 'health_record',
    'address', 'home_address', 'personal_phone', 'emergency_contact'
]

def validate_input(query: str) -> Tuple[bool, str]:
    if not query or not query.strip():
        return False, "Empty input received."
    
    if len(query) > MAX_INPUT_LENGTH:
        return False, "Your message is too long. Please keep it under 500 characters."
    
    query_lower = query.lower()
    for pattern in SQL_INJECTION_PATTERNS:
        if re.search(pattern, query_lower, re.IGNORECASE):
            return False, "I can't process that request."

    # Check for prompt injection
    is_injection, _ = detect_prompt_injection(query)
    if is_injection:
         return False, "I cannot process that request due to safety guidelines."

    # Check if on topic
    on_topic, msg = is_on_topic(query)
    if not on_topic:
        return False, msg
    
    return True, ""

PERMISSIONS = {
    "executive": {
        "actions": ["create", "read", "update", "delete", "approve", "reject", "configure", "upload"],
        "resources": ["profiles", "leaves", "tasks", "attendance", "payroll", "announcements", "policies", "departments", "teams"]
    },
    "manager": {
        "actions": ["read", "create", "update", "approve", "reject"],
        "resources": ["profiles", "leaves", "tasks", "attendance", "teams", "timesheets"]
    },
    "teamlead": {
        "actions": ["read", "update", "approve_timesheet", "raise_correction"],
        "resources": ["tasks", "attendance", "leaves", "timesheets", "profiles"]
    },
    "employee": {
        "actions": ["read", "create_own", "update_own"],
        "resources": ["tasks", "attendance", "leaves", "timesheets", "payroll"]
    }
}

def detect_prompt_injection(query: str) -> Tuple[bool, float]:
    query_lower = query.lower()
    risk_score = 0.0
    
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, query_lower, re.IGNORECASE):
            risk_score += 0.3
    
    is_injection = risk_score >= 0.3
    return is_injection, min(risk_score, 1.0)

def is_on_topic(query: str) -> Tuple[bool, str]:
    query_lower = query.lower()
    for pattern in OFF_TOPIC_PATTERNS:
        if re.search(pattern, query_lower, re.IGNORECASE):
            return False, "I'm TalentOps AI, focused on HR and workforce tasks. I cannot answer general questions or topics outside of workplace management."
    return True, ""

def sanitize_output(data: Any) -> Any:
    if data is None: return data
    if isinstance(data, list):
        return [sanitize_single_record(record) for record in data[:MAX_OUTPUT_RECORDS]]
    if isinstance(data, dict):
        return sanitize_single_record(data)
    return data

def sanitize_single_record(record: Dict) -> Dict:
    if not isinstance(record, dict): return record
    sanitized = {}
    for key, value in record.items():
        if any(sensitive in key.lower() for sensitive in SENSITIVE_FIELDS):
            continue
        if isinstance(value, dict):
            sanitized[key] = sanitize_single_record(value)
        elif isinstance(value, list):
            sanitized[key] = [sanitize_single_record(item) if isinstance(item, dict) else item for item in value]
        else:
            sanitized[key] = value
    return sanitized
