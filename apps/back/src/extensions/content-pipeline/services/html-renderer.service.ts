import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AllConfigType } from '@src/config/config.type';
import type { ContentPipelineConfig } from '@ext/content-pipeline/config/content-pipeline-config.type';

const execFileAsync = promisify(execFile);

/** Default path to the Chromium binary preinstalled in the Alpine Docker image. */
const DEFAULT_CHROMIUM_PATH = '/usr/bin/chromium-browser';

const SCREENSHOT_TIMEOUT_MS = 30_000;
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1920;

export interface RenderToPngParams {
  /** Each string is a full HTML document. */
  htmlContents: string[];
  /** Pixel width. Default 1080. */
  width?: number;
  /** Pixel height. Default 1920 (9:16). */
  height?: number;
  /** Output directory. Temp dir created if not provided. */
  outputDir?: string;
}

/**
 * Renders HTML strings to PNG images using Chromium headless.
 *
 * In the Docker image, Chromium is preinstalled via `apk add chromium` and
 * its shared libraries are resolved by the system loader — no `LD_LIBRARY_PATH`
 * override is needed (unlike the previous Playwright bundled binary on the
 * Foundation host).
 *
 * Each HTML document is written to a temp file and screenshotted via the
 * `--screenshot` flag.
 */
@Injectable()
export class HtmlRendererService {
  private readonly logger = new Logger(HtmlRendererService.name);
  private readonly cfg: ContentPipelineConfig | null;
  private readonly chromiumPath: string;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
  ) {
    this.cfg = this.configService.get('content-pipeline', { infer: true }) ?? null;
    this.chromiumPath = this.cfg?.chromiumPath ?? DEFAULT_CHROMIUM_PATH;
  }

  get isConfigured(): boolean {
    return !!this.chromiumPath;
  }

  /**
   * Render an array of HTML documents to PNG screenshots.
   * Returns an array of PNG file paths (one per HTML document, same order).
   */
  async renderToPng(params: RenderToPngParams): Promise<string[]> {
    const htmlContents = params.htmlContents ?? [];
    if (htmlContents.length === 0) {
      throw new Error('Cannot render: no htmlContents provided');
    }

    const width = params.width ?? DEFAULT_WIDTH;
    const height = params.height ?? DEFAULT_HEIGHT;
    const outDir =
      params.outputDir ?? (await mkdtemp(join(tmpdir(), 'cp-html-render-')));

    this.logger.log(
      `Rendering ${htmlContents.length} HTML documents to PNG (${width}x${height}), outDir=${outDir}`,
    );

    const pngPaths: string[] = [];
    // We need a temp dir for the HTML files (cleaned up in finally).
    // PNGs go into outDir (persisted).
    const htmlDir = await mkdtemp(join(tmpdir(), 'cp-html-src-'));

    try {
      for (let i = 0; i < htmlContents.length; i++) {
        const html = htmlContents[i] ?? '';
        const htmlPath = join(
          htmlDir,
          `slide-${String(i).padStart(3, '0')}.html`,
        );
        const pngPath = join(
          outDir,
          `slide-${String(i).padStart(3, '0')}.png`,
        );
        await writeFile(htmlPath, html, 'utf8');

        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          SCREENSHOT_TIMEOUT_MS,
        );

        try {
          this.logger.debug(
            `Screenshot ${i + 1}/${htmlContents.length}: ${htmlPath} → ${pngPath}`,
          );
          await execFileAsync(
            this.chromiumPath,
            [
              '--headless',
              '--no-sandbox',
              '--disable-gpu',
              `--screenshot=${pngPath}`,
              `--window-size=${width},${height}`,
              `file://${htmlPath}`,
            ],
            {
              signal: controller.signal,
              maxBuffer: 10 * 1024 * 1024,
            },
          );
          pngPaths.push(pngPath);
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') {
            throw new Error(
              `Screenshot ${i} timed out after ${SCREENSHOT_TIMEOUT_MS}ms`,
            );
          }
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Screenshot ${i} failed: ${msg}`);
        } finally {
          clearTimeout(timer);
        }
      }

      this.logger.log(
        `Rendered ${pngPaths.length} PNGs to ${outDir}`,
      );
      return pngPaths;
    } finally {
      // Clean up HTML temp files — keep PNGs (in outDir)
      rm(htmlDir, { recursive: true, force: true }).catch(
        (err: unknown) => {
          this.logger.warn(
            `Failed to clean HTML temp dir ${htmlDir}: ${err instanceof Error ? err.message : String(err)}`,
          );
        },
      );
    }
  }
}