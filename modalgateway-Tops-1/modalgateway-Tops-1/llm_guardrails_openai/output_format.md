# Output Format Specifications

## Response Length Guidelines

| Response Type | Target Length | Max Length |
|--------------|---------------|------------|
| Simple Answer | 50-100 words | 150 words |
| Guidance | 100-200 words | 300 words |
| Template | 150-300 words | 500 words |
| Refusal | 20-40 words | 50 words |

**API Setting:** `max_tokens=500`

---

## Standard Response Structures

### 1. Template Responses

```
[Brief introduction]

[Template with [placeholders]]

[Optional usage tip]
```

### 2. Guidance Responses

```
[Direct answer in 1-2 sentences]

[Supporting details as bullets/numbered list]

[Optional concluding tip]
```

### 3. Refusal Responses

```
[Single sentence from refusal_templates.json]
```

### 4. Multi-Part Responses

```
[Address in-scope portion]

However, [refusal for out-of-scope portion].
```

---

## Formatting Standards

**Headings:** Use `**Label:**` format
**Lists:** Bullets for unordered, numbers for steps
**Emphasis:** Bold for labels and key terms
**Placeholders:** `[Square Brackets]`

---

## Prohibited Elements

❌ Emojis, excessive punctuation, ALL CAPS (except acronyms), casual abbreviations, long paragraphs (>5 sentences)

---

## Persona-Specific Formatting

- **HR:** Detailed (200-300 words), empathetic
- **PM:** Concise (150-200 words), action-oriented
- **Executive:** Brief (100-150 words), strategic

---

## Quality Checklist

- [ ] Within length guidelines
- [ ] Professional tone
- [ ] Clear structure
- [ ] Square bracket placeholders
- [ ] Exact refusal templates
- [ ] Actionable content

---

**Version:** 1.0 | **Date:** 2026-01-08
