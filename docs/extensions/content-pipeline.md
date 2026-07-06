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
# Video templates — CTA clip appended to every template video (optional)
CONTENT_PIPELINE_CTA_VIDEO_PATH=/data/cta/cta-clip.mp4
# Design system injection — DESIGN.md / BRAND.md injected into LLM prompts (optional)
CONTENT_PIPELINE_DESIGN_DOC_PATH=/data/brand/DESIGN.md
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

### Video Templates

| Method | Path | Description |
|--------|------|-------------|
| GET | `content-pipeline/templates` | List all predefined video templates |
| GET | `content-pipeline/templates/:type` | Get a specific template definition |
| POST | `content-pipeline/templates/generate` | Generate a video from a template + fill data |

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
| VideoTemplateService | 10 predefined video templates with CTA video concatenation |
| DesignSystemLoaderService | Loads DESIGN.md from disk and injects brand guidelines into LLM prompts |
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

## Video Templates

The `VideoTemplateService` provides 10 predefined video templates that structure content into narrative arcs. Every template appends a pre-configured CTA video clip at the end (unless disabled).

### Template types

| Template | Arc | Slots | Transitions |
|----------|-----|-------|-------------|
| `before-after` | Estado anterior → Estado después → Resultado | before, after, metric (optional) | slideleft, fade |
| `product-showcase` | Vista frontal → Vista posterior → 2 características | front (img), back (img), feature, feature | circleopen, slideleft, fade |
| `presentation` | Título → Agenda → 3 Contenidos → Resumen | title, agenda, content×3, summary | fade, slideleft, slideright, fade, wipeup |
| `tutorial` | Hook → Paso 1-3 → Resultado | hook, step×3, result (img or text) | fade, slideleft, slideup, circleopen, fade |
| `case-study` | Problema → Solución → Implementación → Resultados → Testimonio | problem, solution, implementation, metric, testimonial | fade, slideleft, wipeup, circleopen, fade |
| `faq` | 3 preguntas frecuentes con sus respuestas | question, answer, question, answer, question, answer | fade, slideleft, fade, slideleft, fade |
| `comparison` | Hook → Opción A → Opción B → Veredicto | hook, feature-a, feature-b, verdict | slideleft, slideright, circleopen, fade |
| `timeline` | Hito inicial → 2-3 hitos → Estado actual | title, milestone, milestone, milestone, current-state | wipeup, slideleft, wipeup, fade |
| `problem-solution` | Problema → Por qué fallan → Enfoque → Cómo funciona | problem, why-fail, approach, how-it-works | fade, slideleft, circleopen, fade |
| `quote-insight` | Cita → Contexto → Desarrollo → Takeaway | quote, context, expansion, takeaway | fade, fade, slideleft, fade |

Each slot accepts either:
- An **image URL** (for image-based slots like `front`, `back`, `before`, `after`, `result`)
- A **carousel slide** (typed object with `type`, `title`, `body`, etc.) → rendered to branded HTML → PNG

### CTA Video

A pre-configured MP4 clip appended to every template video with a smooth xfade fade transition (0.5s). Stored once and reused across all template generations.

Resolution order for the CTA video path:
1. `ctaVideoPath` in the generate request body (per-call override)
2. `ctaVideoPath` on the template definition (per-template override)
3. `setCtaVideo()` runtime override (in-memory)
4. `CONTENT_PIPELINE_CTA_VIDEO_PATH` env var (global default)

If no CTA path is configured, the content video is returned without a CTA (logged as warning).

### FFmpeg CTA concat

```
ffmpeg -i content.mp4 -i cta.mp4 \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.5:offset={content_dur-0.5}[vfinal]" \
  -map "[vfinal]" -c:v libx264 -preset ultrafast -crf 24 -pix_fmt yuv420p -r 30 output.mp4
```

- `offset = content_duration - transition_duration` (ffprobe probes content duration first)
- Result: smooth fade between last frame of content and first frame of CTA

### Endpoints

```http
GET /v1/content-pipeline/templates
GET /v1/content-pipeline/templates/:type
POST /v1/content-pipeline/templates/generate
```

### Generate from template

```json
POST /v1/content-pipeline/templates/generate
{
  "template": "before-after",
  "format": "vertical",
  "transitions": ["slideleft", "fade"],
  "slideDurationSec": 3,
  "ctaVideoPath": "/data/cta/custom.mp4",
  "slots": {
    "0": { "imageUrl": "https://example.com/before.jpg" },
    "1": { "imageUrl": "https://example.com/after.jpg" },
    "2": { "slide": { "type": "metric", "metricValue": "62%", "metricLabel": "Reducción de tiempo" } }
  }
}
```

Response:

```json
{
  "videoPath": "/tmp/cp-tpl-final-xxx/final.mp4",
  "durationSec": 12.5,
  "sizeBytes": 1024000,
  "carouselHtml": ["<!doctype html>..."],
  "postText": "Mira esta transformación...",
  "ctaVideoPath": "/data/cta/cta-clip.mp4",
  "templateType": "before-after"
}
```

### Pipeline flow

1. Get template definition by type
2. Validate required slots are filled
3. Separate image-based slots (imageUrl) from text-based slots (carousel slide)
4. `CarouselGeneratorService` → branded HTML slides for text slots
5. `HtmlRendererService` → PNG screenshots
6. Build ordered `VideoSlide[]` (images + rendered PNGs, in template slot order)
7. `VideoGeneratorService.generateVideo()` → content MP4 with xfade transitions
8. `VideoGeneratorService.concatWithCta()` → append CTA clip with xfade fade
9. Return `TemplateVideoResult` with final video path, durations, post text

### Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `CONTENT_PIPELINE_CTA_VIDEO_PATH` | *(none)* | Path to pre-configured CTA video clip (MP4) |

## Design System Injection

The `DesignSystemLoaderService` reads a brand design document (DESIGN.md, BRAND.md, or any markdown file) from disk and injects its content into LLM prompts after the main generation instructions. This ensures all generated content follows consistent brand tone, voice, and visual style.

### Configuration

```bash
# .env
CONTENT_PIPELINE_DESIGN_DOC_PATH=/data/brand/DESIGN.md
```

| Env var | Default | Description |
|---------|---------|-------------|
| `CONTENT_PIPELINE_DESIGN_DOC_PATH` | *(none)* | Path to a markdown file with brand guidelines, injected into LLM system prompts |

When not set, the LLM prompt works without the design doc injection — generation proceeds normally with the default system prompt only.

### How it works

1. `ContentGeneratorService` builds the standard system prompt (brand voice, audience, language, content type)
2. `DesignSystemLoaderService.getDesignDoc()` reads the configured file from disk
3. If a doc is loaded, it is appended to the system prompt under a `## BRAND DESIGN SYSTEM` section:
   ```
   {standard system prompt}

   ## BRAND DESIGN SYSTEM
   Follow these design guidelines for tone, style, and visual consistency:

   {DESIGN.md content}
   ```
4. The combined prompt is sent to the LLM (Ollama Cloud)

### File format

Any markdown file works — `DESIGN.md`, `BRAND.md`, or a custom name. The file should contain brand guidelines the LLM should follow: tone of voice, vocabulary, formatting conventions, visual style cues, do/don't lists, etc. The raw markdown is injected as-is.

### Cache behavior

- The file is read **once** on first access and cached in memory
- Subsequent calls return the cached content (no disk I/O)
- If the file changes on disk, call `DesignSystemLoaderService.reload()` to clear the cache — the next `getDesignDoc()` call re-reads the file
- If the file cannot be read (missing, permissions), a warning is logged and the cache is set to empty string — generation continues without injection

### Example DESIGN.md

```markdown
# SOM-OS Brand Guidelines

## Tone
- Direct, technical, no fluff
- Spanish (Spain) primary, English secondary
- Address the reader as "tú"

## Style
- Short paragraphs (max 3 lines)
- Bold for key terms on first use
- No emojis in blog content; allowed in social captions

## Visual
- Dark backgrounds (#07070a)
- Accent color: #b56cff
- Headings: Inter Tight, body: Inter
```

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