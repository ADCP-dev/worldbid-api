import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { CONTENT_PIPELINE_VIDEO_QUEUE } from '@ext/content-pipeline/services/video-job.processor';
import type {
  VideoJobData,
  VideoJobResult,
  VideoJobOptions,
} from '@ext/content-pipeline/services/video-job.processor';

export interface EnqueueResult {
  jobId: string;
  status: string;
}

export interface VideoJobStatus {
  jobId: string;
  state: string;
  result?: VideoJobResult;
  failedReason?: string;
}

export interface EnqueueTemplateData {
  templateType: string;
  slots: Record<number, { imageUrl?: string; slide?: Record<string, unknown> }>;
  options?: VideoJobOptions;
}

/**
 * Thin facade over the BullMQ video queue. The controllers call the enqueue*
 * methods (which return a jobId immediately) and the GET polling endpoint
 * calls getJobStatus().
 */
@Injectable()
export class VideoQueueService {
  private readonly logger = new Logger(VideoQueueService.name);

  constructor(
    @InjectQueue(CONTENT_PIPELINE_VIDEO_QUEUE)
    private readonly queue: Queue<VideoJobData, VideoJobResult>,
  ) {}

  async enqueueGenerateVideo(draftId: string): Promise<EnqueueResult> {
    const job = await this.queue.add(
      'generate-video',
      { type: 'generate-video', draftId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 86_400 * 7 },
      },
    );
    this.logger.log(
      `Enqueued generate-video job ${job.id} for draft ${draftId}`,
    );
    return { jobId: job.id!, status: 'queued' };
  }

  async enqueueGenerateCarouselVideo(
    draftId: string,
    options?: { format?: 'portrait' | 'vertical'; transitions?: string[] },
  ): Promise<EnqueueResult> {
    const job = await this.queue.add(
      'generate-carousel-video',
      {
        type: 'generate-carousel-video',
        draftId,
        options: {
          format: options?.format,
          transitions: options?.transitions,
        },
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 86_400 * 7 },
      },
    );
    this.logger.log(
      `Enqueued generate-carousel-video job ${job.id} for draft ${draftId}`,
    );
    return { jobId: job.id!, status: 'queued' };
  }

  async enqueueGenerateTemplate(
    data: EnqueueTemplateData,
  ): Promise<EnqueueResult> {
    const job = await this.queue.add(
      'generate-template',
      {
        type: 'generate-template',
        templateType: data.templateType,
        slots: data.slots,
        options: data.options,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 86_400 * 7 },
      },
    );
    this.logger.log(
      `Enqueued generate-template job ${job.id} for template ${data.templateType}`,
    );
    return { jobId: job.id!, status: 'queued' };
  }

  async getJobStatus(jobId: string): Promise<VideoJobStatus> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    const state = await job.getState();
    const result = job.returnvalue ?? undefined;
    const failedReason = job.failedReason ?? undefined;

    return { jobId, state, result, failedReason };
  }
}
