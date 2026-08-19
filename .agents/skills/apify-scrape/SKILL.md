---
name: apify-scrape
description: >-
  Run Apify Actors to scrape websites and extract structured data.
  Use to deep-scrape documentation sites into local Markdown for the
  knowledge graph. Use when Tavily results are insufficient.
---

# Apify Scraper Skill

Run Apify Actors (scrapers) to extract structured data from websites.
Results are fetched from the actor's default dataset after the run completes.

## When to Use

**Use when:**
- Tavily returned useful URLs but you need the FULL content of those pages
- Integrating a new library with extensive web documentation
- Need offline access to a documentation site for repeated reference
- Building a local mirror of an API reference

**Do NOT use for:**
- Quick lookups → Tavily or Context7
- Sites blocking scraping → check robots.txt first
- < 3 pages of relevant docs → read them manually

## How to Use

Apify API v2. Runs an Actor asynchronously, polls for results, fetches dataset.

**Base URL:** `https://api.apify.com/v2`
**Auth:** `Authorization: Bearer APIFY_API_KEY` (token from Apify Console > Integrations)
**API Key:** `APIFY_API_KEY` from `.env`

### Step 1: Run the Actor

```http
POST /v2/acts/{actorId}/runs
Content-Type: application/json

{
  "startUrls": [{ "url": "https://docs.example.com" }],
  "maxCrawlPages": 20,
  "maxCrawlingDepth": 2
}
```

**Actor IDs for common tasks:**
- `apify/website-content-crawler` — scrape websites, outputs Markdown + HTML
- `apify/web-scraper` — generic web scraping with Cheerio/Puppeteer

**Response:** Run object with `id`, `status`, `defaultDatasetId`

### Step 2: Wait for completion

```http
GET /v2/acts/{actorId}/runs/{runId}
```
Poll every 5 seconds until `status` is `SUCCEEDED`. Max wait: 5 minutes.
If `status` is `FAILED` or `TIMED-OUT`, report error.

### Step 3: Fetch results from dataset

```http
GET /v2/datasets/{defaultDatasetId}/items?format=json&clean=true
```

### Alternative: Run synchronously (simpler, 300s timeout)

```http
POST /v2/acts/{actorId}/run-sync
Content-Type: application/json

{ ... same input ... }
```

Returns dataset items directly. Use for small scrapes (< 300s). For larger scrapes, use async Steps 1-3.

## Input for Website Content Crawler

```json
{
  "startUrls": [{ "url": "https://docs.example.com/api-reference" }],
  "maxCrawlPages": 20,
  "maxCrawlingDepth": 2,
  "crawlerType": "playwright:adaptive",
  "excludeUrlGlobs": ["**/blog/**", "**/changelog/**"],
  "outputFormats": ["Markdown"]
}
```

## Rules

1. **Only if Tavily is insufficient** — Apify costs money per compute unit
2. **Max 20 pages per scrape** to control costs
3. **Save output** to `docs/research/<source-name>/<slug>.md`
4. **After scraping**, run `graphify ./docs --update` to integrate into the graph
5. **Include scrape metadata** in each file (date, source URL, actor used)
6. **Respect robots.txt** — check `Disallow` rules before scraping
7. **Prefer `run-sync`** for quick scrapes, async Steps 1-3 for large ones

## Output Convention

```
docs/research/<source-name>/
├── _index.md              ← TOC for this source
├── getting-started.md
├── api-reference.md
└── ...
```

Each file starts with YAML frontmatter:
```yaml
---
id: "research-apify-<source>-<slug>"
type: "research"
parent: null
dependencies: []
source: "Apify"
source_url: "<original URL>"
date_scraped: "<ISO date>"
actor: "apify/website-content-crawler"
---
```

## Fallback

If `APIFY_API_KEY` is not configured: report "Apify not available — use Context7 for docs or Tavily for broader research."
