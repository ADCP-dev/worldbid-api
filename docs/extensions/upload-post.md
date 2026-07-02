# Upload-Post — Social Media Automation

> Extension for the Upload-Post API. Multi-platform publishing, scheduling, analytics, AutoDMs, FFmpeg processing, and weekly reports for SOM-OS.

## Overview

Integrates the [Upload-Post API](https://docs.upload-post.com) into Foundation as a drop-in extension. Manages a single client profile (SOM-OS itself), not multiple clients.

## Installation

### 1. Environment variables

Add to `apps/back/.env`:

```env
# Required
UPLOAD_POST_API_KEY=your-api-key-here
UPLOAD_POST_PROFILE_USERNAME=som-os

# Optional
UPLOAD_POST_WEBHOOK_SECRET=your-webhook-secret
UPLOAD_POST_WEEKLY_REPORT_EMAIL=adrian@som-os.dev
UPLOAD_POST_WEEKLY_REPORT_TELEGRAM_CHAT_ID=
UPLOAD_POST_WEEKLY_REPORT_CRON=0 9 * * 1
```

### 2. Wiring (one-time)

The extension is auto-discovered by `ExtensionLoaderModule.register()`. Two core files need a one-line addition:

**`src/config/config.type.ts`** — add the import and type:

```typescript
import { UploadPostConfig } from '@ext/upload-post/config/upload-post-config.type';

export type AllConfigType = {
  // ...existing...
  'upload-post': UploadPostConfig;
};
```

**`src/core/infrastructure.module.ts`** — add the config loader:

```typescript
import uploadPostConfig from '@ext/upload-post/extension.config';

// In ConfigModule.forRoot({ load: [...] })
load: [
  // ...existing...
  uploadPostConfig,
  ...discoverExtensionConfigs(),
],
```

### 3. Run migrations

```bash
cd apps/back
pnpm migration:generate AddUploadPostTables
pnpm migration:run
```

## Architecture

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
│   ├── upload-post-client.service.ts  ← HTTP wrapper (all 45 endpoints)
│   ├── upload.service.ts              ← Upload video/photo/text + local DB sync
│   ├── schedule.service.ts            ← List/update/cancel scheduled posts
│   ├── analytics.service.ts           ← Live analytics + daily cron snapshot
│   ├── autodm.service.ts             ← AutoDM monitor lifecycle + local DB sync
│   ├── ffmpeg.service.ts              ← FFmpeg jobs + presets (social MP4, crop, burn text)
│   ├── webhooks.service.ts            ← Webhook config + inbound event handler
│   ├── queue.service.ts               ← Queue preview/next-slot/settings
│   ├── weekly-report.service.ts       ← Weekly report from snapshots (cron + email)
│   ├── platforms.service.ts           ← FB/LinkedIn/Pinterest/Google Business pages
│   └── instagram.service.ts           ← Instagram media/comments/DMs
├── controllers/
│   ├── upload.controller.ts
│   ├── schedule.controller.ts
│   ├── analytics.controller.ts
│   ├── autodm.controller.ts
│   ├── ffmpeg-webhooks.controller.ts
│   ├── queue-weekly.controller.ts
│   └── platforms-instagram.controller.ts
└── dto/
    ├── upload.dto.ts
    ├── autodm.dto.ts
    └── common.dto.ts
```

## Entities

| Entity | Table | Purpose |
|--------|-------|---------|
| `UpPostEntity` | `ext_uploadpost_post` | Local record of every upload dispatched (status, results, scheduled date) |
| `UpPostAnalyticsSnapshotEntity` | `ext_uploadpost_analytics_snapshot` | Daily snapshot per platform (followers, reach, views, likes…) for weekly report |
| `UpPostAutodmMonitorEntity` | `ext_uploadpost_autodm_monitor` | Cache of AutoDM monitors (status, DMs sent, expiry) |

## API Endpoints

### Upload
| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/upload-post/upload/video` | Upload video to multiple platforms (async) |
| POST | `/v1/upload-post/upload/photo` | Upload photos to multiple platforms (async) |
| POST | `/v1/upload-post/upload/text` | Post text-only |
| GET | `/v1/upload-post/upload/status` | Check upload status by request_id or job_id |
| GET | `/v1/upload-post/upload/history` | Upload history from Upload-Post |
| GET | `/v1/upload-post/upload/local` | Local DB upload records |

### Schedule
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/upload-post/schedule` | List all scheduled posts |
| PATCH | `/v1/upload-post/schedule/:jobId` | Update scheduled post (date, title, caption) |
| DELETE | `/v1/upload-post/schedule/:jobId` | Cancel scheduled post |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/upload-post/analytics/:profileUsername` | Live analytics for a profile |
| GET | `/v1/upload-post/analytics/total-impressions/:profileUsername` | Total impressions across platforms |
| GET | `/v1/upload-post/analytics/post/:requestId` | Analytics for a specific post |
| GET | `/v1/upload-post/analytics/platform-metrics` | Aggregated platform metrics |

### AutoDM
| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/upload-post/autodms/start` | Start AutoDM monitor for an Instagram post |
| GET | `/v1/upload-post/autodms/status` | Get monitor status |
| GET | `/v1/upload-post/autodms/logs` | Get monitor logs |
| POST | `/v1/upload-post/autodms/pause` | Pause a monitor |
| POST | `/v1/upload-post/autodms/resume` | Resume a monitor |
| POST | `/v1/upload-post/autodms/stop` | Stop a monitor |
| POST | `/v1/upload-post/autodms/delete` | Delete a monitor |
| GET | `/v1/upload-post/autodms/local` | Local DB monitors |

### FFmpeg
| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/upload-post/ffmpeg/job` | Create FFmpeg job with custom command |
| GET | `/v1/upload-post/ffmpeg/job/:jobId` | Check job status |
| GET | `/v1/upload-post/ffmpeg/usage` | Check FFmpeg quota usage |
| POST | `/v1/upload-post/ffmpeg/preset/social-mp4` | Convert to H.264 MP4 |
| POST | `/v1/upload-post/ffmpeg/preset/extract-audio` | Extract audio to WAV |
| POST | `/v1/upload-post/ffmpeg/preset/crop-vertical` | Crop to 9:16 vertical |
| POST | `/v1/upload-post/ffmpeg/preset/burn-text` | Burn text overlay onto video |
| POST | `/v1/upload-post/ffmpeg/preset/concat` | Concatenate two videos |

### Webhooks
| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/upload-post/webhooks/configure` | Configure webhook notifications |
| POST | `/v1/upload-post/webhooks/incoming` | Inbound webhook receiver (no auth) |

### Queue
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/upload-post/queue/preview` | Preview queue |
| GET | `/v1/upload-post/queue/next-slot` | Next available slot |
| GET | `/v1/upload-post/queue/settings` | Get queue settings |
| POST | `/v1/upload-post/queue/settings` | Update queue settings |

### Weekly Report
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/upload-post/weekly-report` | Generate report (JSON) |
| POST | `/v1/upload-post/weekly-report/send` | Generate + send via email |

### Platform Metadata
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/upload-post/platforms/facebook/pages` | Facebook pages |
| GET | `/v1/upload-post/platforms/linkedin/pages` | LinkedIn pages |
| GET | `/v1/upload-post/platforms/pinterest/boards` | Pinterest boards |
| GET | `/v1/upload-post/platforms/google-business/locations` | Google Business locations |
| POST | `/v1/upload-post/platforms/google-business/locations/select` | Select GBP location |
| GET | `/v1/upload-post/platforms/reddit/detailed-posts/:postId` | Reddit post details |

### Instagram
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/upload-post/instagram/media` | Instagram media list |
| GET | `/v1/upload-post/instagram/comments` | Comments for a post |
| POST | `/v1/upload-post/instagram/comments/reply` | Reply to comment (private DM) |
| POST | `/v1/upload-post/instagram/dms/send` | Send DM |
| GET | `/v1/upload-post/instagram/dms/conversations` | List DM conversations |

## Automated Crons

| Cron | Schedule | Description |
|------|----------|-------------|
| `dailySnapshot` | `0 23 * * *` (daily 23:00) | Fetches analytics for all platforms and stores daily snapshot in DB |
| `sendReport` | Configurable via `UPLOAD_POST_WEEKLY_REPORT_CRON` (default: `0 9 * * 1` Monday 09:00) | Generates and sends weekly report via email |

## Weekly Report

The weekly report compiles data from the daily snapshots stored in `ext_uploadpost_analytics_snapshot`:

- **Followers** + delta (vs previous week)
- **Reach, Views, Likes, Comments, Shares, Saves** per platform
- **Total impressions** across all platforms
- **Top platform** by reach+views

If no snapshots exist (first run), it falls back to live API data without deltas.

Delivered via email (HTML/text) to the configured `UPLOAD_POST_WEEKLY_REPORT_EMAIL`.

## Platforms Supported

Instagram, TikTok, YouTube, LinkedIn, Facebook, X (Twitter), Threads, Pinterest, Reddit, Bluesky, Discord, Telegram.