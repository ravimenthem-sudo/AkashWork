# Fallback Contract: Gateway ↔ OpenAI LLM Integration

## Overview

This document defines the **integration contract** between the gateway/orchestrator and the OpenAI LLM guardrail module. It specifies when and how to invoke the LLM as a fallback assistant.

---

## System Architecture Context

```
User Query
    ↓
┌─────────────────┐
│ Gateway/Modal   │
│ Orchestrator    │
└────────┬────────┘
         │
         ├─→ [PRIMARY] SLM + RAG ──→ High Confidence? → Return to User
         │                              │
         │                              ↓ Low Confidence / Cannot Answer
         │                              │
         └─→ [FALLBACK] OpenAI LLM ────┘
             (with Guardrails)
```

**Key Principle:** The OpenAI LLM is **NOT** the primary intelligence. It is invoked **only** when the SLM+RAG cannot provide a satisfactory answer.

---

## When to Invoke the LLM (Triggering Conditions)

### ✅ Invoke LLM When:

1. **SLM Returns Low Confidence**
   - SLM confidence score < threshold (e.g., 0.6)
   - SLM explicitly returns "uncertain" or "cannot answer"

2. **SLM Defers to LLM**
   - SLM recognizes query is outside its RAG knowledge base
   - SLM returns a "fallback_required" flag

3. **Workplace Query Outside RAG Scope**
   - Query is clearly workplace-related (HR, communication, templates)
   - But not covered by RAG documents
   - Example: "Help me draft a professional apology email to a colleague"

4. **Template or Communication Assistance**
   - User explicitly requests templates, drafts, or phrasing help
   - Query is within LLM allowed domains
   - Example: "Create an executive summary template for project updates"

### ❌ Do NOT Invoke LLM When:

1. **SLM Provides High-Confidence Answer**
   - SLM confidence score ≥ threshold
   - Answer is complete and relevant

2. **Query is Clearly Out of Domain**
   - General knowledge questions (e.g., "What is the capital of France?")
   - Real-time information (e.g., "What's the weather?")
   - Personal advice (e.g., "Should I buy a house?")
   - **Action:** Return a generic "out of scope" message without invoking LLM

3. **Company-Specific Data Requests**
   - Queries requiring database access (e.g., "What's my leave balance?")
   - Internal policy lookups (e.g., "What's our remote work policy?")
   - **Action:** Direct user to appropriate internal resource (HR, system, etc.)

4. **SLM is Sufficient**
   - SLM already answered the query satisfactorily
   - No need for additional processing

---

## Integration Flow

### Step-by-Step Process

```
1. Receive User Query
   ↓
2. Route to SLM + RAG
   ↓
3. Evaluate SLM Response
   ├─→ High Confidence & Complete? → Return SLM Response
   └─→ Low Confidence / Uncertain?
       ↓
4. Pre-Filter for LLM Eligibility
   ├─→ Clearly Out of Domain? → Return Generic Refusal
   └─→ Workplace-Related?
       ↓
5. Invoke OpenAI LLM with Guardrails
   ↓
6. Return LLM Response to User
```

### Pre-Filter Logic (Step 4)

Before invoking the LLM, perform lightweight domain detection:

```python
# Pseudocode
def should_invoke_llm(query, slm_response):
    # Don't invoke if SLM is confident
    if slm_response.confidence >= 0.6:
        return False
    
    # Don't invoke for obvious out-of-domain queries
    forbidden_keywords = [
        "weather", "news", "sports", "stock", "movie", 
        "game", "recipe", "health", "medical"
    ]
    if any(keyword in query.lower() for keyword in forbidden_keywords):
        return False
    
    # Don't invoke for data requests
    data_request_keywords = [
        "my leave balance", "my salary", "my performance", 
        "company policy on", "employee record"
    ]
    if any(phrase in query.lower() for phrase in data_request_keywords):
        return False
    
    # Invoke for workplace communication/templates
    workplace_keywords = [
        "email", "template", "draft", "message", "communicate",
        "leave request", "feedback", "summary", "report"
    ]
    if any(keyword in query.lower() for keyword in workplace_keywords):
        return True
    
    # Default: invoke if SLM is uncertain and query isn't obviously forbidden
    return True
```

---

## API Integration

### Loading System Prompt

```python
import os

# Load system prompt from guardrails module
GUARDRAILS_PATH = "llm_guardrails_openai"
with open(os.path.join(GUARDRAILS_PATH, "system_prompt.txt"), "r") as f:
    SYSTEM_PROMPT = f.read()
```

### OpenAI API Call

```python
import openai

def invoke_llm_fallback(user_query, context=None):
    """
    Invoke OpenAI LLM with guardrails as fallback assistant.
    
    Args:
        user_query (str): The user's query
        context (dict, optional): Additional context (persona, conversation history)
    
    Returns:
        str: LLM response
    """
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]
    
    # Optional: Add conversation context if available
    if context and "history" in context:
        messages.extend(context["history"])
    
    # Add user query
    messages.append({"role": "user", "content": user_query})
    
    # Call OpenAI API
    response = openai.ChatCompletion.create(
        model="gpt-4",  # or "gpt-3.5-turbo" for cost optimization
        messages=messages,
        temperature=0.3,  # Low temperature for consistency
        max_tokens=500,   # Limit response length
        top_p=0.9,
        frequency_penalty=0.0,
        presence_penalty=0.0
    )
    
    return response.choices[0].message.content
```

### Recommended Model Parameters

| Parameter | Value | Reasoning |
|-----------|-------|-----------|
| `model` | `gpt-4` or `gpt-3.5-turbo` | Balance quality and cost |
| `temperature` | `0.3` | Low for deterministic, consistent responses |
| `max_tokens` | `500` | Enforce concise responses |
| `top_p` | `0.9` | Standard nucleus sampling |

---

## Response Handling

### Success Response

```json
{
  "status": "success",
  "source": "llm_fallback",
  "response": "Here's a professional leave request template...",
  "metadata": {
    "model": "gpt-4",
    "tokens_used": 234,
    "confidence": "fallback"
  }
}
```

### Refusal Response (LLM Refused Out-of-Scope Query)

```json
{
  "status": "refused",
  "source": "llm_fallback",
  "response": "I'm designed to assist with workplace communication and HR-related tasks only. For general information, please use a general-purpose search tool or assistant.",
  "metadata": {
    "refusal_reason": "out_of_domain",
    "refusal_template": "general_knowledge"
  }
}
```

### Error Handling

```json
{
  "status": "error",
  "source": "llm_fallback",
  "error_message": "OpenAI API timeout",
  "fallback_action": "return_generic_error_to_user"
}
```

---

## Failure Handling

### LLM API Failures

| Failure Type | Gateway Action |
|--------------|----------------|
| API Timeout | Return generic error: "Unable to process request. Please try again." |
| Rate Limit | Queue request or return: "Service temporarily busy. Please retry shortly." |
| Invalid API Key | Log critical error, return generic error to user |
| Model Error | Log error, return: "Unable to generate response. Please contact support." |

### LLM Refuses Query

If LLM returns a refusal template:
- **Action:** Return refusal message to user as-is
- **Do NOT:** Re-invoke LLM or attempt to bypass guardrails
- **Log:** Track refusal for monitoring

### LLM Returns Unexpected Response

If LLM response seems out of character or violates guardrails:
- **Action:** Log for review, return generic error
- **Do NOT:** Return potentially unsafe response to user

---

## Context Passing (Optional)

### Persona Context

If gateway can detect user role or query type, pass persona hint:

```python
context = {
    "persona": "hr_professional"  # or "project_manager", "executive"
}

# LLM will adapt tone accordingly (see personas.md)
```

### Conversation History

For multi-turn conversations, pass recent history:

```python
context = {
    "history": [
        {"role": "user", "content": "I need help with a leave request"},
        {"role": "assistant", "content": "I can help you draft a professional leave request..."}
    ]
}
```

**Limit:** Keep history to last 3-5 turns to avoid token bloat.

---

## Monitoring & Logging

### Required Logs

For each LLM invocation, log:

```json
{
  "timestamp": "2026-01-08T11:30:00Z",
  "user_id": "user_12345",
  "query": "Help me draft a project update email",
  "slm_confidence": 0.4,
  "llm_invoked": true,
  "llm_response_type": "success",  // or "refused", "error"
  "refusal_template": null,  // or template name if refused
  "tokens_used": 234,
  "latency_ms": 1200
}
```

### Metrics to Track

- **LLM Invocation Rate:** % of queries that trigger LLM fallback
- **Refusal Rate:** % of LLM responses that are refusals
- **Refusal Breakdown:** Which refusal templates are most common
- **Latency:** Average LLM response time
- **Cost:** Token usage and API costs

### Alerts

Set up alerts for:
- High refusal rate (may indicate pre-filter issues)
- High LLM invocation rate (may indicate SLM underperformance)
- API errors or timeouts
- Unexpected response patterns

---

## Security & Privacy

### Do NOT Pass to LLM:
- ❌ Sensitive employee data (SSN, salary, performance records)
- ❌ Proprietary company information
- ❌ Authentication tokens or credentials
- ❌ PII beyond what's necessary for context

### Safe to Pass:
- ✅ Generic user queries
- ✅ Workplace communication requests
- ✅ Template requests
- ✅ General HR questions

### Data Retention

- **OpenAI API:** Be aware of OpenAI's data retention policies
- **Recommendation:** Use OpenAI's zero-retention API option if available
- **Gateway:** Log only necessary metadata, not full query content if sensitive

---

## Testing & Validation

### Pre-Deployment Checklist

- [ ] System prompt loads correctly
- [ ] Pre-filter logic prevents obvious out-of-domain queries
- [ ] LLM refuses out-of-scope queries appropriately
- [ ] LLM responds to in-scope queries correctly
- [ ] Error handling works for API failures
- [ ] Logging captures required metadata
- [ ] Latency is acceptable (< 3 seconds)
- [ ] Cost per query is within budget

### Test Cases

Use `test_prompts.json` to validate:
- In-scope queries return helpful responses
- Out-of-scope queries return refusals
- Edge cases are handled correctly

---

## Cost Optimization

### Strategies

1. **Pre-Filter Aggressively:** Don't invoke LLM for obvious out-of-domain queries
2. **Use GPT-3.5-Turbo:** For cost-sensitive deployments (vs. GPT-4)
3. **Limit Max Tokens:** Set `max_tokens=500` to cap response length
4. **Cache Common Queries:** Cache LLM responses for identical queries (if appropriate)
5. **Monitor Token Usage:** Track and optimize prompt length

### Cost Estimates (Approximate)

| Model | Cost per 1K Tokens | Avg Query Cost | 1000 Queries/Day Cost |
|-------|-------------------|----------------|----------------------|
| GPT-4 | $0.03 (input) + $0.06 (output) | ~$0.02 | ~$20/day |
| GPT-3.5-Turbo | $0.0015 (input) + $0.002 (output) | ~$0.001 | ~$1/day |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-08 | Initial contract definition |

---

## Contact & Support

For integration questions or issues:
- Review `README.md` for module overview
- Check `test_prompts.json` for expected behavior
- Consult `guardrails.yaml` for domain definitions
- Review `output_format.md` for response structure

---

**This contract is the authoritative source for gateway integration with the OpenAI LLM guardrail module.**
