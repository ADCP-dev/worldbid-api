---
name: tavily-search
description: >-
  Search the web for up-to-date technical documentation, breaking changes,
  and solutions using Tavily's LLM-optimized search API. Use before
  implementing external APIs or when a compilation error persists.
---

# Tavily Search Skill

Search the web for current technical information using Tavily's
LLM-optimized search API. Returns clean text with AI-generated summaries.

## When to Use

**ALWAYS use before:**
- Implementing an external API (Stripe, OpenAI, Firebase, AWS)
- Using a library with recent major version bumps
- Choosing between alternative libraries (e.g. "BullMQ vs RabbitMQ 2026")

**Use when stuck:**
- Compilation/runtime error persists after 2 fix attempts
- Model knowledge may be outdated (post-mid-2025 libraries)

**Do NOT use for:**
- Project-internal questions → `vectorize_buscar_codigo` or Graphify
- Library-specific docs → Context7 (free, already available)
- Simple syntax → Context7

## How to Use

**Endpoint:** `POST https://api.tavily.com/search`
**Auth:** Bearer token in `Authorization` header (`Bearer tvly-YOUR_KEY`)
**API Key:** `TAVILY_API_KEY` from `.env`

```json
{
  "query": "stripe checkout session API 2026 breaking changes",
  "search_depth": "advanced",
  "topic": "general",
  "max_results": 5,
  "include_answer": "advanced",
  "include_raw_content": false
}
```

**Key parameters:**

| Param | Values | Notes |
|---|---|---|
| `search_depth` | `basic` (1 credit), `advanced` (2 credits), `fast`, `ultra-fast` | Use `advanced` for technical queries |
| `topic` | `general`, `news`, `finance` | Use `general` for technical docs |
| `max_results` | 0-20, default 5 | |
| `include_answer` | `true`, `false`, `"basic"`, `"advanced"` | LLM-generated summary |
| `include_raw_content` | `true`, `false`, `"markdown"`, `"text"` | Full page content |
| `time_range` | `day`, `week`, `month`, `year` | Filter by publish date |
| `include_domains` | `["docs.stripe.com"]` | Restrict to specific domains |
| `exclude_domains` | `["reddit.com"]` | Exclude noise domains |

**Response fields:** `query`, `answer` (if requested), `results[]` (title, url, content, score), `images[]`, `response_time`

## Rules

1. **Max 3 queries per task** — Tavily costs API credits
2. **Always `search_depth: "advanced"` + `topic: "general"`** for technical queries
3. **Save findings** to `docs/research/<issue>--<topic>.md` with YAML frontmatter
4. **Cite sources** — include URL for each result used
5. **Check Context7 first** — free for library-specific docs
6. **Use `include_domains`** to restrict to official docs when you know the domain

## Output Format

Save to `docs/research/<issue>--<topic>.md`:

```markdown
---
id: "research-tavily-<topic>"
type: "research"
parent: null
dependencies: []
source: "Tavily"
query: "<original query>"
date: "<ISO date>"
---

# Research: <Topic>

## Summary
<AI-generated answer from Tavily>

## Sources
- [<title>](<url>) — summary

## Key Findings for Implementation
- bullet points relevant to code
```

## Fallback

If `TAVILY_API_KEY` is not configured: report "Tavily not available — using Context7 for library docs and model knowledge for general queries."
