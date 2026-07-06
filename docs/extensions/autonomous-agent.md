# Autonomous Agent Extension

Bucle autónomo que schedula, ejecuta, monitoriza, y aprende del pipeline de contenido. Coordina content-pipeline via BullMQ + @Cron. Feedback loop: métricas → research.

## Overview

| Property | Value |
|----------|-------|
| Name | `autonomous-agent` |
| Version | 1.0.0 |
| Dependencies | None (content-pipeline is soft dependency via try/catch require) |
| Tables | `ext_aa_config`, `ext_aa_run` |
| Config key | `'autonomous-agent'` |
| Auth | Admin-only (all endpoints) |

## Configuration

```bash
# .env
AA_QUEUE_PREFIX=aa
AA_DEFAULT_RESEARCH_CRON=0 9 * * *
AA_DEFAULT_GENERATE_CRON=0 10 * * *
AA_DEFAULT_PUBLISH_CRON=0 18 * * *
AA_DEFAULT_METRICS_CRON=0 9 * * 1
AUTONOMOUS_AGENT_NOTIFICATION_EMAIL=adrian@example.com
```

## API Endpoints

### Configs
| Method | Path | Description |
|--------|------|-------------|
| GET | `autonomous-agent/configs` | List configs (paginated) |
| POST | `autonomous-agent/configs` | Create config (one per project) |
| GET | `autonomous-agent/configs/:id` | Get config |
| PATCH | `autonomous-agent/configs/:id` | Update config |
| POST | `autonomous-agent/configs/:id/pause` | Pause agent |
| POST | `autonomous-agent/configs/:id/resume` | Resume agent |
| DELETE | `autonomous-agent/configs/:id` | Delete config |

### Runs
| Method | Path | Description |
|--------|------|-------------|
| GET | `autonomous-agent/runs` | List runs (filter by projectId, runType, status) |
| GET | `autonomous-agent/runs/:id` | Get run details |

## Services

| Service | Responsibility |
|---------|---------------|
| AgentConfigService | CRUD configs, pause/resume |
| AgentRunService | CRUD runs, tracking |
| PipelineOrchestratorService | BullMQ queue enqueue (research, generate, publish, metrics) |
| FeedbackService | Analyze metrics, adjust research priorities (soft dep on content-pipeline) |
| NotificationService | Email notifications via QueuedMailerService (NOTIFICATION_EMAIL chain) |

## Autonomy Levels

| Level | autoApproveIdeas | autoApproveDrafts | Behavior |
|-------|------------------|-------------------|----------|
| Full-manual | false | false | Human approves ideas + drafts |
| Semi-auto | true | false | Ideas auto-approved, drafts need human |
| Full-auto | true | true | Everything published automatically |

## Frontend

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/app/autonomous-agent` | KPIs, recent runs, active configs |
| Configs list | `/app/autonomous-agent/configs` | DataTable |
| Create config | `/app/autonomous-agent/configs/create` | Form (Zod) |
| Config detail | `/app/autonomous-agent/configs/[id]` | Edit + pause/resume |
| Runs history | `/app/autonomous-agent/runs` | DataTable with filters |