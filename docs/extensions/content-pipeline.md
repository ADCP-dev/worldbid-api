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
# Video generation (optional — defaults work on Foundation host)
CONTENT_PIPELINE_FFMPEG_PATH=/home/hermeswebui/.local/bin/ffmpeg
CONTENT_PIPELINE_FONT_PATH=/home/hermeswebui/.local/share/fonts/DejaVuSans-Bold.ttf
# HTML rendering (optional — defaults work on Foundation host)
CONTENT_PIPELINE_CHROMIUM_PATH=/home/hermeswebui/.hermes/home/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell
CONTENT_PIPELINE_CHROMIUM_LIB_DIR=/home/hermeswebui/.hermes/home/.local/lib/usr/lib/x86_64-linux-gnu
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
| POST | `content-pipeline/drafts/:id/generate-video` | Generate 9:16 MP4 from draft images |
| POST | `content-pipeline/drafts/:id/generate-carousel-video` | Generate carousel HTML → PNG → MP4 with hyperframes |

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
| DraftService | CRUD drafts, approve/reject/publish, video + carousel generation |
| VideoGeneratorService | FFmpeg MP4 from images + ASS subtitles + xfade hyperframe transitions |
| HtmlRendererService | Chromium headless HTML → PNG screenshots |
| CarouselGeneratorService | Branded HTML carousel slides (SOM-OS design system) |
| MetricsService | Metrics tracking, snapshots, cleanup |

## Video Generation

The `VideoGeneratorService` produces a 9:16 (1080x1920) MP4 video from a draft's images using FFmpeg. It is designed for short-form video platforms (Reels, Shorts, TikTok).

### How it works

1. Downloads each draft image (hero + content types) to a temp directory
2. Generates an ASS subtitle file with text overlays (using the first socialVariant caption)
3. Builds an FFmpeg filtergraph: scale + crop to 1080x1920 → **xfade** transitions between slides → global fade in/out → subtitles overlay
4. Encodes with libx264 (`-preset ultrafast -crf 26 -pix_fmt yuv420p -r 25`)
5. Stores the result in `draft.videos` jsonb field

### xfade Hyperframe Transitions

The video generator uses FFmpeg's `xfade` filter for smooth transitions between slides (replacing the old hard-cut `concat`). Available transitions:

`fade`, `slideleft`, `slideright`, `slideup`, `slidedown`, `circleopen`, `circleclose`, `wipeup`, `wipedown`, `wiperight`, `wipeleft`, `radial`, `duality`

- Default: `['fade']` for all transitions
- Custom: pass `transitions` array (cycled if fewer than slide count)
- Transition duration: 0.4s
- Global fade in (0.5s at start) + fade out (0.5s at end)
- Offset for each xfade: `i * slideDuration - transitionDuration`

### Endpoint

```http
POST /v1/content-pipeline/drafts/:id/generate-video
```

Generates a video from the draft's images. Requires at least one hero or content image. Returns the updated draft with the new video entry in `videos`.

### Draft.videos format

```json
[
  {
    "path": "/tmp/cp-video-out-xxx/output.mp4",
    "platform": "shorts",
    "format": "mp4",
    "width": 1080,
    "height": 1920,
    "durationSec": 9,
    "sizeBytes": 407000,
    "createdAt": "2026-07-06T11:00:00.000Z"
  }
]
```

### Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `CONTENT_PIPELINE_FFMPEG_PATH` | `/home/hermeswebui/.local/bin/ffmpeg` | Path to FFmpeg binary |
| `CONTENT_PIPELINE_FONT_PATH` | `/home/hermeswebui/.local/share/fonts/DejaVuSans-Bold.ttf` | Path to .ttf font for subtitles |
| `CONTENT_PIPELINE_CHROMIUM_PATH` | Playwright bundled chrome-headless-shell | Path to Chromium binary |
| `CONTENT_PIPELINE_CHROMIUM_LIB_DIR` | `/home/hermeswebui/.hermes/home/.local/lib/usr/lib/x86_64-linux-gnu` | Shared libs dir for LD_LIBRARY_PATH |

### Requirements

- FFmpeg 7.0+ with `libx264`, `xfade`, and `subtitles` (libass) filter support
- The `drawtext` filter is NOT required (uses ASS subtitles instead)
- The `zoompan` filter is NOT used (CPU-intensive, avoids timeouts)
- Default slide duration: 3 seconds (configurable via `slideDurationSec` param)
- Timeout: 120 seconds

## Carousel Generation

The `CarouselGeneratorService` generates branded LinkedIn carousel slides as self-contained HTML documents, using the SOM-OS design system (dark background, gradient accents, Inter Tight font).

### How it works

1. Takes carousel slide content (from LLM or derived from blog headings)
2. Builds one complete HTML document per slide with inline CSS
3. Supports 7 slide types: `hook`, `context`, `step`, `metric`, `testimonial`, `summary`, `cta`
4. Also generates the accompanying LinkedIn post text (100-200 words)
5. Two formats: `portrait` (1080×1350, LinkedIn 4:5) or `vertical` (1080×1920, 9:16 video)

### Brand configuration

Uses the SOM-OS brand by default:

| Token | Value |
|-------|-------|
| `name` | SOM-OS |
| `bg` | #07070a |
| `text` | #f4f4f6 |
| `accent` | #b56cff |
| `gradient` | linear-gradient(110deg,#00f0ff 0%,#6c8cff 28%,#b56cff 55%,#ff5fd2 82%,#ffb86c 100%) |
| `fontName` | Inter Tight |
| `followTag` | SOM-OS.dev · Desliza → |

Custom `BrandConfig` can be passed to override any token.

## HTML Rendering

The `HtmlRendererService` renders HTML strings to PNG images using Chromium headless (Playwright's bundled `chrome-headless-shell`).

### How it works

1. For each HTML string: writes to a temp file
2. Runs `chrome-headless-shell --headless --no-sandbox --disable-gpu --screenshot=... --window-size=... file://...`
3. Sets `LD_LIBRARY_PATH` to `chromiumLibDir` for shared library resolution
4. 30s timeout per screenshot (AbortController)
5. Cleans up HTML temp files, keeps PNGs
6. ~1.7s per slide screenshot

### Method

```typescript
async renderToPng(params: {
  htmlContents: string[];
  width?: number;   // default 1080
  height?: number;  // default 1920
  outputDir?: string;
}): Promise<string[]>  // PNG file paths
```

## Carousel Video Pipeline

The full orchestrated pipeline: draft content → carousel HTML → PNG screenshots → MP4 with xfade hyperframes.

### Endpoint

```http
POST /v1/content-pipeline/drafts/:id/generate-carousel-video
```

Body (all optional):

```json
{
  "format": "vertical",       // "portrait" (1080x1350) or "vertical" (1080x1920)
  "transitions": ["fade", "slideleft", "circleopen"]  // xfade transitions
}
```

### Pipeline flow

1. Find draft by ID
2. Extract carousel content from `socialVariants` (carousel type) or derive from `blogContent` headings
3. `CarouselGeneratorService` → branded HTML slides + LinkedIn post text
4. `HtmlRendererService` → PNG screenshots (one per slide)
5. `VideoGeneratorService` → MP4 with xfade hyperframe transitions
6. Store carousel metadata in `draft.carousels` jsonb field
7. Store video in `draft.videos` jsonb field

### Draft.carousels format

```json
[
  {
    "pngDir": "/tmp/cp-carousel-png-xxx",
    "slidesCount": 5,
    "postText": "Check out these 5 steps...",
    "format": "vertical",
    "createdAt": "2026-07-06T11:00:00.000Z"
  }
]
```

### Performance

- 5 slides → ~8.5s screenshots + ~25s FFmpeg = ~34s total
- Output: 1080×1920 H264 MP4, ~734KB

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