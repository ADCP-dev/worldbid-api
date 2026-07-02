# Upload-Post — Social Media Automation

> Extension for the Upload-Post API. Multi-platform publishing, scheduling, analytics, AutoDMs, and weekly reports for SOM-OS. **Admin-only access.**

## Overview

Integrates the [Upload-Post API](https://docs.upload-post.com) into Foundation as a drop-in extension. Manages a single client profile (SOM-OS itself). All endpoints and frontend pages require admin role.

## Installation

### 1. Environment variables

Add to `apps/back/.env`:

```env
UPLOAD_POST_API_KEY=your-api-key
UPLOAD_POST_PROFILE_USERNAME=som-os
UPLOAD_POST_WEEKLY_REPORT_EMAIL=adrian@som-os.dev
# Optional
UPLOAD_POST_WEEKLY_REPORT_CRON=0 9 * * 1
```

### 2. Wiring (one-time)

The extension is auto-discovered by `ExtensionLoaderModule.register()`. Two core files were modified:

- `src/config/config.type.ts` — added `'upload-post': UploadPostConfig` to `AllConfigType`
- `src/core/infrastructure.module.ts` — added `uploadPostConfig` to `ConfigModule.forRoot({ load: [...] })`

### 3. Run migrations

```bash
cd apps/back
pnpm migration:generate AddUploadPostTables
pnpm migration:run
```

### 4. Frontend layer

The Nuxt layer is registered in `apps/front/nuxt.config.ts`:

```typescript
extends: [..., './extensions/upload-post'],
alias: { '@upload-post': '~/extensions/upload-post', ... }
```

## Architecture

### Backend

```
extensions/upload-post/
├── extension.module.ts          ← NestJS module (auto-discovered)
├── extension.manifest.ts        ← Extension metadata
├── extension.config.ts          ← Env validation + registerAs
├── upload-post.provider.ts       ← DI provider for API config
├── config/
│   └── upload-post-config.type.ts
├── infrastructure/persistence/entities/
│   ├── up-post.entity.ts              ← Local upload records
│   ├── up-post-analytics-snapshot.entity.ts  ← Daily analytics snapshots
│   └── up-post-autodm-monitor.entity.ts       ← AutoDM monitor cache
├── services/
│   ├── upload-post-client.service.ts  ← HTTP wrapper (all API endpoints)
│   ├── upload.service.ts              ← Upload video/photo/text + local DB sync
│   ├── schedule.service.ts            ← List/update/cancel scheduled posts
│   ├── analytics.service.ts           ← Live analytics + daily cron snapshot
│   ├── autodm.service.ts             ← AutoDM monitor lifecycle + local DB sync
│   ├── webhooks.service.ts            ← Webhook config + inbound event handler
│   ├── queue.service.ts               ← Queue preview/next-slot/settings
│   ├── weekly-report.service.ts       ← Weekly report from snapshots (cron + email)
│   ├── platforms.service.ts           ← FB/LinkedIn/Pinterest/Google Business pages
│   └── instagram.service.ts           ← Instagram media/comments/DMs
├── controllers/                        ← All @Roles(RoleEnum.admin)
│   ├── upload.controller.ts
│   ├── schedule.controller.ts
│   ├── analytics.controller.ts
│   ├── autodm.controller.ts
│   ├── webhooks.controller.ts
│   ├── queue-weekly.controller.ts
│   └── platforms-instagram.controller.ts
└── dto/
    ├── upload.dto.ts
    ├── autodm.dto.ts
    └── common.dto.ts
```

### Frontend (Nuxt Layer)

```
extensions/upload-post/
├── nuxt.config.ts
├── composables/
│   └── useUploadPost.ts           ← API wrapper for all backend endpoints
└── pages/app/upload-post/
    ├── index.vue                  ← Calendar view with scheduled posts
    ├── analytics.vue              ← Platform metrics + weekly report
    └── autodms.vue                ← AutoDM monitor management
```

## RBAC

**All backend controllers** use `@UseGuards(AuthGuard('jwt'), RolesGuard)` + `@Roles(RoleEnum.admin)`.

**All frontend pages** use `middleware: ['auth', 'admin']` — non-admin users are redirected to `/app`.

The only exception is `POST /upload-post/webhooks/incoming` which is a public endpoint (no auth guard) for receiving webhooks from Upload-Post.

## Entities

| Entity | Table | Purpose |
|--------|-------|---------|
| `UpPostEntity` | `ext_uploadpost_post` | Local record of every upload dispatched |
| `UpPostAnalyticsSnapshotEntity` | `ext_uploadpost_analytics_snapshot` | Daily snapshot per platform for weekly report |
| `UpPostAutodmMonitorEntity` | `ext_uploadpost_autodm_monitor` | Cache of AutoDM monitors |

## Frontend Pages

### `/app/upload-post` — Calendar

Uses the existing `Calendar.vue` component from `@base/ui-app/components/calendar/`.

- **View scheduled posts** as calendar events (month/week/day views)
- **Drag & drop** to reschedule (calls `PATCH /upload-post/schedule/:jobId`)
- **Click on empty slot** to create a new scheduled post (video/photo/text)
- **Click on event** to see details and cancel scheduled posts
- Shows local upload status (pending/processing/success) alongside scheduled posts

### `/app/upload-post/analytics` — Analytics

- Platform cards with followers, reach, views, likes, comments, shares, saves
- Weekly report generation (JSON view + email send)
- Sorted by reach+views (top platform first)

### `/app/upload-post/autodms` — AutoDM

- Table of active/inactive AutoDM monitors
- Start new monitor (post URL, reply message, keywords, interval)
- Pause/resume/stop/delete monitors
- View logs per monitor

## Automated Crons

| Cron | Schedule | Description |
|------|----------|-------------|
| `dailySnapshot` | `0 23 * * *` | Fetches analytics for all platforms, stores daily snapshot |
| `scheduledSendReport` | `UPLOAD_POST_WEEKLY_REPORT_CRON` (default `0 9 * * 1`) | Generates and sends weekly report via email |

## API Endpoints

All endpoints are prefixed `/api/v1/upload-post/` and require JWT + admin role.

### Upload
| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload-post/upload/video` | Upload video (async) |
| POST | `/upload-post/upload/photo` | Upload photos (async) |
| POST | `/upload-post/upload/text` | Post text-only |
| GET | `/upload-post/upload/status` | Check upload status |
| GET | `/upload-post/upload/history` | Upload history |
| GET | `/upload-post/upload/local` | Local DB records |

### Schedule
| Method | Path | Description |
|--------|------|-------------|
| GET | `/upload-post/schedule` | List scheduled posts |
| PATCH | `/upload-post/schedule/:jobId` | Update scheduled post |
| DELETE | `/upload-post/schedule/:jobId` | Cancel scheduled post |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/upload-post/analytics/:profileUsername` | Live analytics |
| GET | `/upload-post/analytics/total-impressions/:profileUsername` | Total impressions |
| GET | `/upload-post/analytics/post/:requestId` | Post analytics |
| GET | `/upload-post/analytics/platform-metrics` | Platform metrics |

### AutoDM
| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload-post/autodms/start` | Start monitor |
| GET | `/upload-post/autodms/status` | Monitor status |
| GET | `/upload-post/autodms/logs` | Monitor logs |
| POST | `/upload-post/autodms/pause` | Pause monitor |
| POST | `/upload-post/autodms/resume` | Resume monitor |
| POST | `/upload-post/autodms/stop` | Stop monitor |
| POST | `/upload-post/autodms/delete` | Delete monitor |

### Webhooks
| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload-post/webhooks/configure` | Configure webhooks (admin) |
| POST | `/upload-post/webhooks/incoming` | Inbound webhook (public) |

### Queue
| Method | Path | Description |
|--------|------|-------------|
| GET | `/upload-post/queue/preview` | Queue preview |
| GET | `/upload-post/queue/next-slot` | Next slot |
| GET/POST | `/upload-post/queue/settings` | Queue settings |

### Weekly Report
| Method | Path | Description |
|--------|------|-------------|
| GET | `/upload-post/weekly-report` | Generate report |
| POST | `/upload-post/weekly-report/send` | Send via email |

### Platform Metadata
| Method | Path | Description |
|--------|------|-------------|
| GET | `/upload-post/platforms/facebook/pages` | Facebook pages |
| GET | `/upload-post/platforms/linkedin/pages` | LinkedIn pages |
| GET | `/upload-post/platforms/pinterest/boards` | Pinterest boards |
| GET | `/upload-post/platforms/google-business/locations` | Google Business locations |
| POST | `/upload-post/platforms/google-business/locations/select` | Select GBP |
| GET | `/upload-post/platforms/reddit/detailed-posts/:postId` | Reddit post details |

### Instagram
| Method | Path | Description |
|--------|------|-------------|
| GET | `/upload-post/instagram/media` | Media list |
| GET | `/upload-post/instagram/comments` | Comments |
| POST | `/upload-post/instagram/comments/reply` | Reply (DM) |
| POST | `/upload-post/instagram/dms/send` | Send DM |
| GET | `/upload-post/instagram/dms/conversations` | DM conversations |

## Platforms Supported

Instagram, TikTok, YouTube, LinkedIn, Facebook, X (Twitter), Threads, Pinterest, Reddit, Bluesky, Discord, Telegram.