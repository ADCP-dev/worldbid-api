import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { AllConfigType } from '@src/config/config.type';
import type { ContentPipelineConfig } from '@ext/content-pipeline/config/content-pipeline-config.type';

const execFileAsync = promisify(execFile);

export interface VideoSlide {
  imageUrl: string;
  text: string;
}

export interface GenerateVideoParams {
  slides: VideoSlide[];
  outputDir?: string;
  slideDurationSec?: number;
  /** xfade transitions between slides, e.g. ['fade','slideleft','circleopen']. Defaults to ['fade'] for all. */
  transitions?: string[];
  /** Whether to burn subtitles. Default true. */
  enableSubtitles?: boolean;
  /** Text per slide for subtitles (if different from slide.text). */
  textOverlay?: string[];
}

export interface GeneratedVideo {
  videoPath: string;
  durationSec: number;
  sizeBytes: number;
}

/** Default path to the FFmpeg binary preinstalled in the Alpine Docker image. */
const DEFAULT_FFMPEG_PATH = '/usr/bin/ffmpeg';
const DEFAULT_SLIDE_DURATION_SEC = 3;
const DEFAULT_TRANSITION_DURATION = 0.4;
const DEFAULT_TRANSITION = 'fade';
const GLOBAL_FADE_DURATION = 0.5;
const TIMEOUT_MS = 120_000;
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const FPS = 25;
const FONT_NAME = 'DejaVu Sans Bold';
const FONT_SIZE = 72;

/**
 * Generates a 9:16 (1080x1920) MP4 video from slide images + text overlays
 * using FFmpeg. Downloads each image, creates an ASS subtitle file, builds
 * a filtergraph (scale → crop → fade → concat → subtitles), and runs FFmpeg.
 *
 * Designed for short-form video platforms (Reels, Shorts, TikTok).
 *
 * Docker-native: FFmpeg is preinstalled at `/usr/bin/ffmpeg` via `apk add ffmpeg`.
 * The font is a public URL (CDN/S3) downloaded once per process and cached.
 */
@Injectable()
export class VideoGeneratorService {
  private readonly logger = new Logger(VideoGeneratorService.name);
  private readonly cfg: ContentPipelineConfig | null;
  private readonly ffmpegPath: string;
  /** Cached local path to the downloaded font (downloaded once per process). */
  private cachedFontPath: string | null = null;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    this.cfg =
      this.configService.get('content-pipeline', { infer: true }) ?? null;
    this.ffmpegPath = this.cfg?.ffmpegPath ?? DEFAULT_FFMPEG_PATH;
  }

  get isConfigured(): boolean {
    return !!this.ffmpegPath;
  }

  /**
   * Generate a 9:16 MP4 video from the given slides.
   * Each slide is shown for `slideDurationSec` seconds (default 3).
   * Returns the output path, duration, and file size.
   * Throws on error (download failure, FFmpeg failure, timeout).
   */
  async generateVideo(params: GenerateVideoParams): Promise<GeneratedVideo> {
    const slides = params.slides ?? [];
    if (slides.length === 0) {
      throw new Error('Cannot generate video: no slides provided');
    }

    const slideDuration = params.slideDurationSec ?? DEFAULT_SLIDE_DURATION_SEC;
    const transitions = params.transitions ?? [DEFAULT_TRANSITION];
    const enableSubtitles = params.enableSubtitles ?? true;
    const textOverlay = params.textOverlay;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // workDir: temp images + ASS file (cleaned in finally)
    // outputDir: final video (persisted, returned to caller)
    const workDir = await mkdtemp(join(tmpdir(), 'cp-video-'));
    const outputDir =
      params.outputDir ?? (await mkdtemp(join(tmpdir(), 'cp-video-out-')));
    const outputPath = join(outputDir, 'output.mp4');

    this.logger.log(
      `Generating video: ${slides.length} slides, ${slideDuration}s each, transitions=[${transitions.join(',')}], subtitles=${enableSubtitles}, workDir=${workDir}`,
    );

    try {
      // 1. Download images to workDir
      const imagePaths: string[] = [];
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        if (!slide?.imageUrl) {
          throw new Error(`Slide ${i} missing imageUrl`);
        }
        const imgPath = await this.downloadImage(
          slide.imageUrl,
          workDir,
          i,
          controller.signal,
        );
        imagePaths.push(imgPath);
      }

      // 2. Resolve font (URL → temp file, cached per process) before subtitles
      const fontPath = enableSubtitles ? await this.resolveFontFile() : '';

      // 3. Build ASS subtitle file (if enabled)
      const assPath = join(workDir, 'overlay.ass');
      if (enableSubtitles) {
        const assContent = this.buildAssFile(
          slides,
          slideDuration,
          textOverlay,
        );
        await writeFile(assPath, assContent, 'utf8');
      }

      // 4. Build FFmpeg filtergraph (xfade hyperframe transitions)
      const filterGraph = this.buildFilterGraph(
        slides.length,
        slideDuration,
        assPath,
        fontPath,
        transitions,
        enableSubtitles,
      );

      // 4. Assemble FFmpeg args
      // -loop 1 -t <dur> per image: treat each image as a video stream of
      // slideDuration seconds. Without this, FFmpeg reads 1 frame per image
      // and the concat produces a fraction-of-a-second video.
      const args: string[] = ['-nostdin', '-loglevel', 'warning'];
      for (const p of imagePaths) {
        args.push('-loop', '1', '-t', String(slideDuration), '-i', p);
      }
      args.push(
        '-filter_complex',
        filterGraph,
        '-map',
        '[vfinal]',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '26',
        '-pix_fmt',
        'yuv420p',
        '-r',
        String(FPS),
        '-y',
        outputPath,
      );

      // 5. Run FFmpeg
      this.logger.log('Running FFmpeg...');
      try {
        const { stderr } = await execFileAsync(this.ffmpegPath, args, {
          signal: controller.signal,
          maxBuffer: 10 * 1024 * 1024,
        });
        if (stderr) {
          this.logger.debug(`FFmpeg stderr (tail): ${stderr.slice(-500)}`);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error(`FFmpeg timed out after ${TIMEOUT_MS}ms`);
        }
        const msg = err instanceof Error ? err.message : String(err);
        const errRecord = (err as Record<string, unknown>) ?? {};
        const stderrStr =
          typeof errRecord['stderr'] === 'string' ? errRecord['stderr'] : '';
        const exitCode =
          typeof errRecord['code'] === 'number' ? errRecord['code'] : '?';
        throw new Error(
          `FFmpeg failed (exit ${exitCode}): ${stderrStr.slice(-800) || msg}`,
        );
      }

      // 6. Verify output and gather stats
      const fileStat = await stat(outputPath);
      // With xfade, total duration = n*slideDuration - (n-1)*transitionDuration
      const transitionDur = DEFAULT_TRANSITION_DURATION;
      const durationSec =
        slides.length > 1
          ? slides.length * slideDuration - (slides.length - 1) * transitionDur
          : slides.length * slideDuration;

      this.logger.log(
        `Video generated: ${outputPath} (${fileStat.size} bytes, ${durationSec}s)`,
      );

      return {
        videoPath: outputPath,
        durationSec,
        sizeBytes: fileStat.size,
      };
    } finally {
      clearTimeout(timer);
      // Clean up temp images + ASS (NOT the output dir)
      rm(workDir, { recursive: true, force: true }).catch((err: unknown) => {
        this.logger.warn(
          `Failed to clean temp dir ${workDir}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
  }

  /**
   * Concatenate a content video with a pre-configured CTA video clip using
   * FFmpeg xfade for a smooth fade transition between them.
   *
   * Pipeline:
   *   1. Probe the content video duration with ffprobe
   *   2. Run FFmpeg: [0:v] content + [1:v] CTA → xfade=transition=fade
   *      offset = content_duration - transitionDuration
   *   3. Encode with libx264 (-preset ultrafast -crf 24 -pix_fmt yuv420p -r 30)
   *   4. Return final video path + duration + size
   *
   * Tested and working FFmpeg command:
   *   ffmpeg -i content.mp4 -i cta.mp4 \
   *     -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.5:offset={dur-0.5}[vfinal]" \
   *     -map "[vfinal]" -c:v libx264 -preset ultrafast -crf 24 -pix_fmt yuv420p -r 30 output.mp4
   */
  async concatWithCta(params: {
    contentVideoPath: string;
    /** S3 presigned/public URL or local file path to the CTA clip. */
    ctaVideoUrl: string;
    outputDir?: string;
    transitionDuration?: number;
  }): Promise<GeneratedVideo> {
    const transitionDur = params.transitionDuration ?? 0.5;
    const outputDir =
      params.outputDir ?? (await mkdtemp(join(tmpdir(), 'cp-cta-concat-')));
    const outputPath = join(outputDir, 'final.mp4');

    if (!params.contentVideoPath) {
      throw new Error('concatWithCta: contentVideoPath is required');
    }
    if (!params.ctaVideoUrl) {
      throw new Error('concatWithCta: ctaVideoUrl is required');
    }

    // Resolve the CTA video URL to a local path (download if it's a URL).
    const ctaLocalPath = await this.resolveAssetToLocal(
      params.ctaVideoUrl,
      'cta-video',
    );

    this.logger.log(
      `Concatenating CTA: content=${params.contentVideoPath}, cta=${params.ctaVideoUrl} → ${ctaLocalPath}, transition=${transitionDur}s`,
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      // 1. Probe content video duration with ffprobe (sibling of ffmpeg binary)
      const ffprobePath = this.deriveFfprobePath();
      const contentDuration = await this.probeDuration(
        ffprobePath,
        params.contentVideoPath,
        controller.signal,
      );

      const offset = Math.max(0, contentDuration - transitionDur);

      this.logger.debug(
        `Content duration: ${contentDuration}s, xfade offset: ${offset}s`,
      );

      // 2. Build FFmpeg args
      const args: string[] = [
        '-nostdin',
        '-loglevel',
        'warning',
        '-i',
        params.contentVideoPath,
        '-i',
        ctaLocalPath,
        '-filter_complex',
        `[0:v][1:v]xfade=transition=fade:duration=${transitionDur}:offset=${offset}[vfinal]`,
        '-map',
        '[vfinal]',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '24',
        '-pix_fmt',
        'yuv420p',
        '-r',
        '30',
        '-y',
        outputPath,
      ];

      // 3. Run FFmpeg
      try {
        const { stderr } = await execFileAsync(this.ffmpegPath, args, {
          signal: controller.signal,
          maxBuffer: 10 * 1024 * 1024,
        });
        if (stderr) {
          this.logger.debug(`FFmpeg stderr (tail): ${stderr.slice(-500)}`);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error(`FFmpeg CTA concat timed out after ${TIMEOUT_MS}ms`);
        }
        const msg = err instanceof Error ? err.message : String(err);
        const errRecord = (err as Record<string, unknown>) ?? {};
        const stderrStr =
          typeof errRecord['stderr'] === 'string' ? errRecord['stderr'] : '';
        const exitCode =
          typeof errRecord['code'] === 'number' ? errRecord['code'] : '?';
        throw new Error(
          `FFmpeg CTA concat failed (exit ${exitCode}): ${stderrStr.slice(-800) || msg}`,
        );
      }

      // 4. Probe final video duration + file size
      const finalDuration = await this.probeDuration(
        ffprobePath,
        outputPath,
        controller.signal,
      );
      const fileStat = await stat(outputPath);

      this.logger.log(
        `CTA concat done: ${outputPath} (${finalDuration}s, ${fileStat.size} bytes)`,
      );

      return {
        videoPath: outputPath,
        durationSec: finalDuration,
        sizeBytes: fileStat.size,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Derive the ffprobe binary path from the ffmpeg path (same dir, ffprobe). */
  private deriveFfprobePath(): string {
    const dir = dirname(this.ffmpegPath);
    return join(dir, 'ffprobe');
  }

  /**
   * Resolve the configured font URL to a local file path.
   * - If the URL is a local path (starts with `/`), use it directly.
   * - Otherwise download from the URL once per process and cache the temp path.
   * Throws if no font URL is configured.
   */
  private async resolveFontFile(): Promise<string> {
    if (this.cachedFontPath) return this.cachedFontPath;

    const fontUrl = this.cfg?.fontUrl;
    if (!fontUrl) {
      throw new Error(
        'No font URL configured (CONTENT_PIPELINE_FONT_URL) — cannot generate video subtitles',
      );
    }

    // Local path — use directly.
    if (fontUrl.startsWith('/')) {
      this.cachedFontPath = fontUrl;
      return fontUrl;
    }

    // Download from URL to a temp file (cached for the process lifetime).
    const tmpFont = join(tmpdir(), `cp-font-${Date.now()}.ttf`);
    const res = await fetch(fontUrl);
    if (!res.ok) {
      throw new Error(
        `Font download failed: ${res.status} ${res.statusText} (${fontUrl})`,
      );
    }
    await writeFile(tmpFont, Buffer.from(await res.arrayBuffer()));
    this.cachedFontPath = tmpFont;
    this.logger.log(`Downloaded font from ${fontUrl} → ${tmpFont} (cached)`);
    return tmpFont;
  }

  /**
   * Resolve a URL-or-local-path asset to a local file path.
   * - Local path (starts with `/`) → used directly.
   * - URL (starts with `http`) → downloaded to a temp file.
   * - Other strings → assumed local, used directly.
   */
  private async resolveAssetToLocal(
    urlOrPath: string,
    prefix: string,
  ): Promise<string> {
    if (urlOrPath.startsWith('/')) return urlOrPath;
    if (!urlOrPath.startsWith('http')) return urlOrPath;

    const tmpFile = join(tmpdir(), `cp-${prefix}-${Date.now()}.mp4`);
    const res = await fetch(urlOrPath);
    if (!res.ok) {
      throw new Error(
        `Asset download failed: ${res.status} ${res.statusText} (${urlOrPath})`,
      );
    }
    await writeFile(tmpFile, Buffer.from(await res.arrayBuffer()));
    this.logger.debug(`Downloaded asset ${urlOrPath} → ${tmpFile}`);
    return tmpFile;
  }

  /** Probe a video file duration (seconds) using ffprobe. */
  private async probeDuration(
    ffprobePath: string,
    videoPath: string,
    signal: AbortSignal,
  ): Promise<number> {
    try {
      const { stdout } = await execFileAsync(
        ffprobePath,
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'default=noprint_wrappers=1:nokey=1',
          videoPath,
        ],
        { signal, maxBuffer: 1024 * 1024 },
      );
      const dur = parseFloat(stdout.trim());
      if (Number.isNaN(dur) || dur <= 0) {
        throw new Error(`ffprobe returned invalid duration: "${stdout}"`);
      }
      return dur;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`ffprobe failed for ${videoPath}: ${msg}`);
    }
  }

  /**
   * Download an image from a URL or decode a data URI to a local file.
   * Returns the local file path.
   */
  private async downloadImage(
    url: string,
    destDir: string,
    index: number,
    signal: AbortSignal,
  ): Promise<string> {
    // Handle data URIs (base64-encoded images)
    if (url.startsWith('data:')) {
      const match = url.match(/^data:image\/([\w+]+);base64,(.+)$/);
      if (!match?.[1] || !match?.[2]) {
        throw new Error(`Slide ${index}: invalid data URI`);
      }
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      const path = join(
        destDir,
        `slide-${String(index).padStart(3, '0')}.${ext}`,
      );
      await writeFile(path, Buffer.from(match[2], 'base64'));
      return path;
    }

    // Handle HTTP(S) URLs
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(
        `Slide ${index}: download failed ${res.status} ${res.statusText}`,
      );
    }
    const contentType = res.headers.get('content-type') ?? '';
    const ext = this.extFromContentType(contentType);
    const path = join(
      destDir,
      `slide-${String(index).padStart(3, '0')}.${ext}`,
    );
    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(path, buffer);
    return path;
  }

  private extFromContentType(contentType: string): string {
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('gif')) return 'gif';
    if (contentType.includes('bmp')) return 'bmp';
    return 'jpg';
  }

  /**
   * Build the ASS subtitle file with one Dialogue line per slide.
   * Text is overlaid at the bottom of the 9:16 frame.
   */
  private buildAssFile(
    slides: VideoSlide[],
    slideDuration: number,
    textOverlay?: string[],
  ): string {
    const header = [
      '[Script Info]',
      'ScriptType: v4.00+',
      `PlayResX: ${VIDEO_WIDTH}`,
      `PlayResY: ${VIDEO_HEIGHT}`,
      'ScaledBorderAndShadow: yes',
      'WrapStyle: 0',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      `Style: Default,${FONT_NAME},${FONT_SIZE},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,2,2,60,60,200,1`,
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ];

    const events: string[] = [];
    for (let i = 0; i < slides.length; i++) {
      const start = i * slideDuration;
      const end = (i + 1) * slideDuration - 0.2;
      const text = this.escapeAssText(
        textOverlay?.[i] ?? slides[i]?.text ?? '',
      );
      events.push(
        `Dialogue: 0,${this.formatAssTime(start)},${this.formatAssTime(end)},Default,,0,0,0,,${text}`,
      );
    }

    return [...header, ...events].join('\n');
  }

  /** Format seconds as ASS timestamp `H:MM:SS.cs` (centiseconds). */
  private formatAssTime(seconds: number): string {
    const totalCs = Math.round(seconds * 100);
    const totalSec = Math.floor(totalCs / 100);
    const cs = totalCs % 100;
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  /** Escape text for ASS Dialogue lines (strip braces, convert newlines). */
  private escapeAssText(text: string): string {
    return text
      .replace(/\n/g, '\\N')
      .replace(/\{/g, '')
      .replace(/\}/g, '')
      .trim();
  }

  /**
   * Build the FFmpeg filtergraph using xfade hyperframe transitions.
   *
   * Layout:
   *   [N:v] scale+crop+setsar+format → [vN]                 (per image)
   *   [v0][v1] xfade=transition=T:duration=D:offset=O → [x1]
   *   [x1][v2] xfade=... → [x2]  ... → [xN-2]
   *   [xN-2] fade in/out → [vfx]
   *   [vfx] subtitles → [vfinal]    (if enabled)
   *
   * offset for xfade i = i * slideDuration - transitionDuration
   * Global fade in (0.5s at start) + fade out (0.5s at end) for polish.
   */
  private buildFilterGraph(
    slideCount: number,
    slideDuration: number,
    assPath: string,
    fontPath: string,
    transitions: string[],
    enableSubtitles: boolean,
  ): string {
    const transitionDur = DEFAULT_TRANSITION_DURATION;
    const parts: string[] = [];

    // Per-image: scale, crop, setsar, format (NO per-slide fades — xfade handles transitions)
    for (let i = 0; i < slideCount; i++) {
      parts.push(
        `[${i}:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},setsar=1,format=yuv420p[v${i}]`,
      );
    }

    // xfade chain
    if (slideCount === 1) {
      // Single slide — no transitions, just pass through
      parts.push(`[v0]null[vxfin]`);
    } else {
      let prevLabel = 'v0';
      for (let i = 1; i < slideCount; i++) {
        const trans =
          transitions[(i - 1) % transitions.length] ?? DEFAULT_TRANSITION;
        const offset = i * slideDuration - transitionDur;
        const outLabel = i === slideCount - 1 ? 'vxfin' : `x${i}`;
        parts.push(
          `[${prevLabel}][v${i}]xfade=transition=${trans}:duration=${transitionDur}:offset=${offset}[${outLabel}]`,
        );
        prevLabel = outLabel;
      }
    }

    // Total duration after xfade chain
    const totalDuration =
      slideCount > 1
        ? slideCount * slideDuration - (slideCount - 1) * transitionDur
        : slideDuration;
    const fadeOutStart = totalDuration - GLOBAL_FADE_DURATION;

    // Global fade in/out for professional polish
    parts.push(
      `[vxfin]fade=t=in:st=0:d=${GLOBAL_FADE_DURATION},fade=t=out:st=${fadeOutStart}:d=${GLOBAL_FADE_DURATION}[vfx]`,
    );

    // Subtitles overlay (ASS file + font directory for libass)
    if (enableSubtitles) {
      const escapedAssPath = this.escapeFilterPath(assPath);
      const escapedFontDir = this.escapeFilterPath(dirname(fontPath));
      parts.push(
        `[vfx]subtitles=${escapedAssPath}:fontsdir=${escapedFontDir}:force_style='Fontname=${FONT_NAME}'[vfinal]`,
      );
    } else {
      parts.push(`[vfx]null[vfinal]`);
    }

    return parts.join(';');
  }

  /** Escape a filesystem path for use in FFmpeg filtergraph syntax. */
  private escapeFilterPath(path: string): string {
    return path
      .replace(/\\/g, '\\\\')
      .replace(/:/g, '\\:')
      .replace(/'/g, "\\'");
  }
}
