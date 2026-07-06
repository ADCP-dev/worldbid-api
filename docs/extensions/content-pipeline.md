---
id: "content-pipeline"
name: "Content Pipeline"
type: "extension"
parent: null
dependencies: ["auth"]
entities: ["CpProject", "CpIdea", "CpDraft", "CpMetrics"]
---

# Content Pipeline Extension

Autonomous content generation pipeline: research → ideas → drafts → publish. Multi-nicho. Integrates optionally with CMS, Upload-Post, and Affiliate extensions.

## Overview

| Property | Value |
|----------|-------|
| Name | `content-pipeline` |
| Version | 1.0.0 |
| Dependencies | None (CMS, Upload-Post, Affiliate are optional runtime deps) |
| Tables | `ext_cp_project`, `ext_cp_idea`, `ext_cp_draft`, `ext_cp_metrics` |
| Config key | `'content-pipeline'` |
| Auth | Admin-only (all endpoints) |

## Configuration

```bash
# .env
TAVILY_API_KEY=tvly-xxx
OLLAMA_BASE_URL=https://api.ollama.cloud/v1
OLLAMA_MODEL=glm-5.2
OLLAMA_API_KEY=xxx
WAVESPEED_API_KEY=xxx
WAVESPEED_DEFAULT_MODEL=flux-2-klein
CONTENT_PIPELINE_NOTIFICATION_EMAIL=adrian@example.com
```

## API Endpoints

### Projects
| Method | Path | Description |
|--------|------|-------------|
| GET | `content-pipeline/projects` | List projects (paginated) |
| POST | `content-pipeline/projects` | Create project |
| GET | `content-pipeline/projects/:id` | Get project |
| PATCH | `content-pipeline/projects/:id` | Update project |
| DELETE | `content-pipeline/projects/:id` | Delete project |

### Ideas
| Method | Path | Description |
|--------|------|-------------|
| GET | `content-pipeline/projects/:projectId/ideas` | List ideas by project |
| POST | `content-pipeline/projects/:projectId/ideas` | Create idea |
| POST | `content-pipeline/projects/:projectId/ideas/research` | Trigger AI research (Tavily) |
| GET | `content-pipeline/ideas/:id` | Get idea |
| PATCH | `content-pipeline/ideas/:id` | Update idea |
| PATCH | `content-pipeline/ideas/:id/status` | Update idea status (kanban move) |
| POST | `content-pipeline/ideas/reorder` | Reorder ideas within column |
| DELETE | `content-pipeline/ideas/:id` | Delete idea |
| POST | `content-pipeline/ideas/:id/generate` | Generate draft from idea |

### Drafts
| Method | Path | Description |
|--------|------|-------------|
| GET | `content-pipeline/projects/:projectId/drafts` | List drafts by project |
| GET | `content-pipeline/drafts/:id` | Get draft |
| PATCH | `content-pipeline/drafts/:id` | Update draft |
| POST | `content-pipeline/drafts/:id/approve` | Approve draft |
| POST | `content-pipeline/drafts/:id/reject` | Reject draft |
| POST | `content-pipeline/drafts/:id/publish` | Publish draft (CMS + Upload-Post) |

### Metrics
| Method | Path | Description |
|--------|------|-------------|
| GET | `content-pipeline/projects/:projectId/metrics` | Get project metrics |
| GET | `content-pipeline/metrics/dashboard` | Global metrics dashboard |

## Services

| Service | Responsibility |
|---------|---------------|
| ProjectService | CRUD projects |
| IdeaService | CRUD ideas, kanban workflow |
| TrendResearchService | Tavily API research, idea generation |
| ContentGeneratorService | Ollama Cloud (GLM-5.2) content generation |
| ImageGeneratorService | WaveSpeed AI image generation |
| SeoOptimizerService | SEO metadata + JSON-LD (pure functions) |
| AffiliateInjectorService | Affiliate link injection (if affiliate ext present) |
| PublishingService | Publish to CMS + Upload-Post (if present) |
| DraftService | CRUD drafts, approve/reject/publish |
| MetricsService | Metrics tracking, snapshots, cleanup |

## Frontend

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/app/content-pipeline` | KPIs, recent projects |
| Projects list | `/app/content-pipeline/projects` | DataTable |
| Create project | `/app/content-pipeline/projects/create` | Form (Zod) |
| Project detail | `/app/content-pipeline/projects/[id]` | Tabs: Ideas, Drafts, Metrics, Settings |
| Ideas kanban | `/app/content-pipeline/projects/[id]/ideas` | Kanban board |
| Drafts list | `/app/content-pipeline/projects/[id]/drafts` | DataTable with actions |
| Draft review | `/app/content-pipeline/drafts/[id]` | RichEditor + approve/reject/publish |