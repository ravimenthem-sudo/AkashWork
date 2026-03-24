import asyncio
import re as _re
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RAG_TEST")

def detect_follow_up(query, last_doc_context, all_docs):
    q_lower = query.lower()
    # Identical regex to unified_server.py
    fresh_starters = r'^(?:what\s+(is|are|was|were)|define|explain|tell\s+me|show|find|search|lookup|give\s+me|describe|about)\b'
    is_general_fresh = bool(_re.match(fresh_starters, q_lower, _re.IGNORECASE))
    has_followup_intent = any(kw in q_lower for kw in [" it", " it's", " them", " those", " these", " that", " this", " they", " its", " its architecture", " how many", " explain in detail", " its design", " why ", " how does it"])
    is_short = len(query.split()) <= 10
    
    mentions_other_doc = False
    match_d_title = None
    for d in all_docs:
        raw_title = str(d.get('title') or "").lower()
        d_title_clean = _re.sub(r'\.(?:pdf|docx|txt|doc|csv|xlsx|pptx)$', '', raw_title, flags=_re.IGNORECASE).strip()
        if last_doc_context and d_title_clean != last_doc_context.lower() and d_title_clean in q_lower and len(d_title_clean) > 4:
            mentions_other_doc = True
            match_d_title = d_title_clean
            break
            
    is_follow_up = (is_short or has_followup_intent) and not (is_general_fresh and not has_followup_intent) and not mentions_other_doc
    
    return is_follow_up, is_general_fresh, has_followup_intent, mentions_other_doc, match_d_title

def calculate_rag_scores(query, target_doc_title, all_docs):
    q_norm = query.lower()
    t_title = target_doc_title.lower() if target_doc_title else None
    results = []
    
    for d in all_docs:
        title = d.get('title', '').lower()
        score = 0.0
        
        # Priority 1: Sticky Context
        if t_title and t_title in title:
            score += 0.5
            
        # Priority 2: Keyword overlap
        keywords = set(_re.findall(r'\b\w{3,}\b', title)) - {'task', 'document', 'guidance', 'activity', 'phase', 'steps'}
        if any(kw in q_norm for kw in keywords):
            match_count = sum(1 for kw in keywords if kw in q_norm)
            score += (match_count * 5.0)
            
        if score > 0:
            results.append({"title": title, "score": score})
            
    results.sort(key=lambda x: x['score'], reverse=True)
    return results

# Test Cases
all_docs = [
    {"title": "Wizard Setup Document.pdf"},
    {"title": "Leave Policy.pdf"},
    {"title": "Employee Handbook.docx"}
]

print("--- RAG FLOW TEST ---")

# TURN 1: Fresh Query
q1 = "what is wizard setup document"
last_doc = None
is_fu, is_fresh, has_fi, mentions_other, m_title = detect_follow_up(q1, last_doc, all_docs)
print(f"\nQ1: '{q1}'")
print(f"  is_follow_up: {is_fu} (expected False)")
scores1 = calculate_rag_scores(q1, None, all_docs)
print(f"  Top Match: {scores1[0] if scores1 else 'None'}")

# TURN 2: Genuine Follow-up
q2 = "explain in detail"
last_doc = "Wizard Setup Document"
is_fu, is_fresh, has_fi, mentions_other, m_title = detect_follow_up(q2, last_doc, all_docs)
print(f"\nQ2: '{q2}' (Sticky: {last_doc})")
print(f"  is_follow_up: {is_fu} (expected True)")
scores2 = calculate_rag_scores(q2, last_doc, all_docs)
print(f"  Top Match: {scores2[0] if scores2 else 'None'}")

# TURN 3: Topic Switch (Problem Case)
q3 = "what is leave policy"
last_doc = "Wizard Setup Document"
is_fu, is_fresh, has_fi, mentions_other, m_title = detect_follow_up(q3, last_doc, all_docs)
print(f"\nQ3: '{q3}' (Sticky: {last_doc})")
print(f"  is_follow_up: {is_fu} (expected False)")
print(f"  is_general_fresh: {is_fresh}")
print(f"  mentions_other: {mentions_other} (Target: {m_title})")

target_title = last_doc if is_fu else "all"
scores3 = calculate_rag_scores(q3, target_title, all_docs)
print(f"  Target used for RAG: {target_title}")
print(f"  Scores: {scores3}")
if scores3 and scores3[0]['title'] == 'leave policy.pdf':
    print("  RESULT: SUCCESS: Topic Switch Success!")
else:
    print("  RESULT: FAILURE: Topic Switch Failed!")

# TURN 4: Follow-up using pronouns
q4 = "what is its architecture"
last_doc = "Wizard Setup Document"
is_fu, is_fresh, has_fi, mentions_other, m_title = detect_follow_up(q4, last_doc, all_docs)
print(f"\nQ4: '{q4}' (Sticky: {last_doc})")
print(f"  is_follow_up: {is_fu} (expected True)")
scores4 = calculate_rag_scores(q4, last_doc, all_docs)
print(f"  Top Match: {scores4[0] if scores4 else 'None'}")
