RAG_KEYWORDS = [
    "policy guide", "handbook", "procedure manual", "holiday rules", "expense policy", 
    "hr guide", "what is the policy", "regulations", "company guidelines", "sop",
    "standard operating procedure", "compliance", "code of conduct", "employee manual",
    "benefits guide", "onboarding guide", "training material", "project documentation",
    "technical specs", "requirements document", "what does the document say",
    "read the policy", "check the handbook", "according to the manual",
    "architecture", "frontend", "backend", "system design", "technical details",
    "module overview", "technical documentation", "search documents", "read document",
    "document content", "tell me about this document", "inside the document",
    "what is in", "what does the doc say", "according to",
    "table of contents", "toc", "summary of", "contents", "explain", "tell me about",
    "detailed description", "overview of", "inside the document", "document content",
    "what is in the document", "read the document", "check the document"
]

SLM_KEYWORDS = [
    "assign task", "create task", "update task", "delete task", "my tasks", "task status",
    "pending tasks", "completed tasks", "overdue tasks", "task deadline", "task priority",
    "clock in", "clock out", "my attendance", "attendance history", "mark attendance",
    "check in", "check out", "time log", "working hours", "late today", "am i late",
    "active", "online", "present", "working today", "who is working", "who is active",
    "apply leave", "request leave", "my leaves", "leave balance", "leave allowance",
    "remaining leaves", "leave history", "cancel leave", "pending leave requests",
    "approve leave", "reject leave", "sick leave", "casual leave", "vacation",
    "my team", "team members", "who is in my team", "team attendance", "team tasks",
    "assigned to me", "assigned to", "team lead", "manager", "colleagues",
    "post announcement", "broadcast", "send message", "notify team", "announce",
    "create announcement", "company announcement", "notifications", "my alerts",
    "recent notifications", "what are my notifications", "show notifications",
    "project documents", "show me project documents", "list files", "my documents", "what documents",
    "view documents", "available documents", "get documents", "show documents",
    "create project", "update project", "project status", "my projects", "project members",
    "add member", "remove member", "project deadline",
    "hiring overview", "job openings", "candidates", "applicants", "interview schedule",
    "shortlist candidate", "recruitment status",
    "my performance", "team performance", "attendance report", "task report",
    "productivity", "kpi", "metrics",
    "org hierarchy", "org chart", "hierarchy chart", "company structure", "reporting lines",
    "who is in the company", "list all employees", "team structure",
    "go to", "open page", "navigate to", "redirect to", "show module", "open module", 
    "show page", "take me to",
    "project hierarchy", "project team", "who is on the project", "project structure",
    "project leads", "project members"
]

q1 = "Explain the table of contents in the wizard setup doc"
q2 = "What are the table of contents in the wizard setup document?"

# Simulate query_lower
q1_lower = q1.lower()
q2_lower = q2.lower()

print(f"Q1 matches RAG? {any(k in q1_lower for k in RAG_KEYWORDS)} -> {[k for k in RAG_KEYWORDS if k in q1_lower]}")
print(f"Q1 matches SLM? {any(k in q1_lower for k in SLM_KEYWORDS)} -> {[k for k in SLM_KEYWORDS if k in q1_lower]}")

print(f"Q2 matches RAG? {any(k in q2_lower for k in RAG_KEYWORDS)} -> {[k for k in RAG_KEYWORDS if k in q2_lower]}")
print(f"Q2 matches SLM? {any(k in q2_lower for k in SLM_KEYWORDS)} -> {[k for k in SLM_KEYWORDS if k in q2_lower]}")
