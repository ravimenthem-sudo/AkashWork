# OpenAI LLM Guardrails Module

## Overview

This module provides a complete guardrail layer for an OpenAI-powered LLM that acts as a **fallback assistant** in an HRM platform. The LLM is invoked only when the primary SLM (Small Language Model) with RAG cannot answer a query.

## Purpose

The OpenAI LLM serves as a **guard-railed backup assistant** with strict domain restrictions:

- ✅ **Allowed**: HR, workplace communication, leave templates, AI Delivery/PM communication, executive summaries
- ❌ **Forbidden**: General knowledge, internet queries, real-time info, personal questions, non-workplace topics

## Module Contents

| File | Purpose |
|------|---------|
| `system_prompt.txt` | Production-ready OpenAI system prompt (use directly in API calls) |
| `guardrails.yaml` | Domain restrictions, safety rules, and refusal conditions |
| `refusal_templates.json` | Standardized professional refusal responses |
| `personas.md` | Tone and vocabulary rules for different workplace roles |
| `fallback_contract.md` | Integration contract for gateway/orchestrator |
| `output_format.md` | Response structure and formatting constraints |
| `test_prompts.json` | Validation test cases for in-scope and out-of-scope queries |

## Quick Start

### 1. Integration with Gateway

```python
# Example: Load system prompt
with open('llm_guardrails_openai/system_prompt.txt', 'r') as f:
    system_prompt = f.read()

# Use in OpenAI API call
response = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_query}
    ],
    temperature=0.3,  # Lower temperature for consistency
    max_tokens=500
)
```

### 2. When to Invoke LLM

Refer to `fallback_contract.md` for detailed triggering conditions:

- ✅ SLM returns low confidence score
- ✅ SLM explicitly defers to LLM
- ✅ Query is workplace-related but outside RAG knowledge base
- ❌ Query is clearly out of domain (general knowledge, personal, etc.)

### 3. Validation

Use `test_prompts.json` to validate the guardrails:

```bash
# Run test suite against your integrated LLM
python test_guardrails.py  # (implement your own test runner)
```

## Key Features

### 🛡️ Domain Restriction
- Enforces strict workplace-only responses
- Refuses general knowledge, internet queries, and personal questions
- Never hallucinates data or claims system access

### 🎭 Persona Awareness
- Adapts language style for HR, PM, or Executive contexts
- Maintains professional tone across all personas
- Does not change scope—only communication style

### 🔒 Privacy & Safety
- No data invention or policy fabrication
- Deterministic outputs with controlled temperature
- Auditable refusal patterns

### 📊 Consistency
- Standardized refusal templates
- Predictable response formats
- Clear boundaries between LLM and SLM roles

## Integration Checklist

- [ ] Load `system_prompt.txt` into your OpenAI API system message
- [ ] Implement triggering logic per `fallback_contract.md`
- [ ] Parse `guardrails.yaml` for runtime validation (optional)
- [ ] Use `refusal_templates.json` for consistent error handling
- [ ] Test with `test_prompts.json` before production deployment
- [ ] Monitor outputs for guardrail violations
- [ ] Set temperature ≤ 0.3 for deterministic responses

## Important Notes

### What This Module IS
- ✅ A complete guardrail specification
- ✅ Production-ready system prompt
- ✅ Integration contract for gateway
- ✅ Test cases for validation

### What This Module IS NOT
- ❌ Backend implementation code
- ❌ OpenAI SDK configuration
- ❌ UI components
- ❌ SLM or RAG logic
- ❌ API key management

## Maintenance

### Updating Allowed Domains
Edit `guardrails.yaml` → `allowed_domains` section

### Adding New Personas
Edit `personas.md` and update `system_prompt.txt` persona section

### Modifying Refusal Messages
Edit `refusal_templates.json` and regenerate `system_prompt.txt` if needed

## Support

For integration questions, refer to:
1. `fallback_contract.md` - Gateway integration
2. `output_format.md` - Response structure
3. `test_prompts.json` - Expected behavior examples

---

**Version**: 1.0  
**Last Updated**: 2026-01-08  
**License**: Internal Use Only
