import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { DraftService } from '@ext/content-pipeline/services/draft.service';
import { VideoTemplateService } from '@ext/content-pipeline/services/video-template.service';
import type {
  TemplateType,
  TemplateFillData,
} from '@ext/content-pipeline/services/video-template.service';

export const CONTENT_PIPELINE_VIDEO_QUEUE = 'content-pipeline-video';

export type VideoJobType =
  | 'generate-video'
  | 'generate-carousel-video'
  | 'generate-template';

export interface VideoJobOptions {
  format?: 'portrait' | 'vertical';
  transitions?: string[];
  ctaVideoUrl?: string;
  slideDurationSec?: number;
}

export interface VideoJobData {
  type: VideoJobType;
  draftId?: string;
  templateType?: string;
  options?: VideoJobOptions;
  slots?: Record<
    number,
    { imageUrl?: string; slide?: Record<string, unknown> }
  >;
}

export interface VideoJobResult {
  videoPath: string;
  durationSec: number;
  sizeBytes: number;
  ctaVideoUrl?: string;
  templateType?: string;
  carouselHtml?: string[];
  postText?: string;
}

/**
 * BullMQ worker that processes video generation jobs for the content-pipeline
 * extension. The three heavy/slow endpoints (draft.generate-video,
 * draft.generate-carousel-video, templates.generate) enqueue jobs here so the
 * HTTP request returns immediately with a jobId (HTTP 202). Clients poll
 * `GET /content-pipeline/video-jobs/:jobId` for status.
 *
 * The worker delegates the actual work to DraftService and
 * VideoTemplateService — the same services the synchronous controllers used
 * previously — so behavior is unchanged, only the execution model is async.
 */
@Processor(CONTENT_PIPELINE_VIDEO_QUEUE)
@Injectable()
export class VideoJobProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoJobProcessor.name);

  constructor(
    private readonly draftService: DraftService,
    private readonly videoTemplateService: VideoTemplateService,
  ) {
    super();
  }

  async process(
    job: Job<VideoJobData, VideoJobResult>,
  ): Promise<VideoJobResult> {
    this.logger.log(`Processing video job ${job.id}: type=${job.data.type}`);

    try {
      switch (job.data.type) {
        case 'generate-video':
          return await this.handleGenerateVideo(job.data);
        case 'generate-carousel-video':
          return await this.handleGenerateCarouselVideo(job.data);
        case 'generate-template':
          return await this.handleGenerateTemplate(job.data);
        default:
          throw new Error(`Unknown video job type: ${job.data.type}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Video job ${job.id} failed: ${message}`);
      // Re-throw so BullMQ applies its retry/backoff policy.
      throw err;
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  //  Handlers
  // ───────────────────────────────────────────────────────────────────────

  private async handleGenerateVideo(
    data: VideoJobData,
  ): Promise<VideoJobResult> {
    if (!data.draftId) {
      throw new Error('draftId required for generate-video');
    }
    const draft = await this.draftService.generateVideo(data.draftId);
    const videos = Array.isArray(draft.videos) ? draft.videos : [];
    const lastVideo = videos[videos.length - 1] as
      | Record<string, unknown>
      | undefined;
    if (!lastVideo) {
      throw new Error('Video generation produced no result');
    }
    return {
      videoPath: String(lastVideo['path'] ?? ''),
      durationSec: Number(lastVideo['durationSec'] ?? 0),
      sizeBytes: Number(lastVideo['sizeBytes'] ?? 0),
    };
  }

  private async handleGenerateCarouselVideo(
    data: VideoJobData,
  ): Promise<VideoJobResult> {
    if (!data.draftId) {
      throw new Error('draftId required for generate-carousel-video');
    }
    const draft = await this.draftService.generateCarouselVideo(data.draftId, {
      format: data.options?.format,
      transitions: data.options?.transitions,
    });
    const videos = Array.isArray(draft.videos) ? draft.videos : [];
    const carousels = Array.isArray(draft.carousels) ? draft.carousels : [];
    const lastVideo = videos[videos.length - 1] as
      | Record<string, unknown>
      | undefined;
    const lastCarousel = carousels[carousels.length - 1] as
      | Record<string, unknown>
      | undefined;
    if (!lastVideo) {
      throw new Error('Carousel video generation produced no result');
    }
    return {
      videoPath: String(lastVideo['path'] ?? ''),
      durationSec: Number(lastVideo['durationSec'] ?? 0),
      sizeBytes: Number(lastVideo['sizeBytes'] ?? 0),
      postText:
        typeof lastCarousel?.['postText'] === 'string'
          ? (lastCarousel['postText'] as string)
          : undefined,
    };
  }

  private async handleGenerateTemplate(
    data: VideoJobData,
  ): Promise<VideoJobResult> {
    if (!data.templateType) {
      throw new Error('templateType required for generate-template');
    }
    // Validate the template type using the service's own type guard before
    // casting through unknown (avoids `as any`).
    if (!this.videoTemplateService.isValidTemplateType(data.templateType)) {
      throw new Error(`Unknown template type: ${data.templateType}`);
    }
    const templateType = data.templateType as unknown as TemplateType;

    const fillData: TemplateFillData = {
      slots: (data.slots ?? {}) as unknown as TemplateFillData['slots'],
      transitions: data.options?.transitions,
      slideDurationSec: data.options?.slideDurationSec,
      ctaVideoUrl: data.options?.ctaVideoUrl,
      format: data.options?.format,
    };

    const result = await this.videoTemplateService.generateFromTemplate({
      template: templateType,
      fillData,
    });

    return {
      videoPath: result.videoPath,
      durationSec: result.durationSec,
      sizeBytes: result.sizeBytes,
      ctaVideoUrl: result.ctaVideoUrl,
      templateType: result.templateType,
      carouselHtml: result.carouselHtml,
      postText: result.postText,
    };
  }
}
