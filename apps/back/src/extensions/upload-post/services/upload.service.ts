import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type DeepPartial } from 'typeorm';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';
import { UpPostEntity } from '@ext/upload-post/infrastructure/persistence/entities/up-post.entity';
import { PublisherValidationError } from '@ext/upload-post/services/publisher.service';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly client: UploadPostClientService,
    @InjectRepository(UpPostEntity)
    private readonly postRepo: Repository<UpPostEntity>,
  ) {}

  async uploadVideo(params: {
    title: string;
    platforms: string[];
    videoUrl?: string;
    videoBuffer?: Buffer;
    videoFilename?: string;
    caption?: string;
    profileUsername?: string;
    scheduledDate?: string;
    thumbUrl?: string;
    facebookMediaType?: string;
    youtubeCategory?: string;
    youtubeTags?: string[];
    pinterestBoard?: string;
    redditSubreddit?: string;
    redditTitle?: string;
  }) {
    const user = params.profileUsername ?? this.client.profileUsername;
    if (!user) throw new Error('profileUsername is required (not configured)');

    const entity = this.postRepo.create({
      mediaType: 'video',
      title: params.title,
      caption: params.caption,
      platforms: params.platforms,
      profileUsername: user,
      mediaUrl: params.videoUrl,
      status: params.scheduledDate ? 'scheduled' : 'pending',
      scheduledAt: params.scheduledDate
        ? new Date(params.scheduledDate)
        : undefined,
    } as DeepPartial<UpPostEntity>);
    const saved = await this.postRepo.save(entity);

    try {
      const result = await this.client.uploadVideo({
        title: params.title,
        user,
        platforms: params.platforms,
        videoUrl: params.videoUrl,
        videoBuffer: params.videoBuffer,
        videoFilename: params.videoFilename,
        caption: params.caption,
        scheduledDate: params.scheduledDate,
        asyncUpload: true,
        thumbUrl: params.thumbUrl,
        facebookMediaType: params.facebookMediaType,
        youtubeCategory: params.youtubeCategory,
        youtubeTags: params.youtubeTags,
        pinterestBoard: params.pinterestBoard,
        redditSubreddit: params.redditSubreddit,
        redditTitle: params.redditTitle,
      });

      saved.requestId = result.request_id;
      saved.jobId = result.job_id ?? null;
      saved.status = 'processing';
      await this.postRepo.save(saved);

      return { localId: saved.id, ...result };
    } catch (err: unknown) {
      saved.status = 'error';
      saved.errorMessage = err instanceof Error ? err.message : String(err);
      await this.postRepo.save(saved);
      throw err;
    }
  }

  async uploadPhotos(params: {
    title?: string;
    platforms: string[];
    photoUrls?: string[];
    photoBuffers?: Array<{ buffer: Buffer; filename: string }>;
    caption?: string;
    profileUsername?: string;
    scheduledDate?: string;
    addToQueue?: boolean;
    timezone?: string;
    pinterestBoard?: string;
  }) {
    const user = params.profileUsername ?? this.client.profileUsername;
    if (!user) throw new Error('profileUsername is required (not configured)');

    const entity = this.postRepo.create({
      mediaType: 'photo',
      title: params.title,
      caption: params.caption,
      platforms: params.platforms,
      profileUsername: user,
      status: params.scheduledDate ? 'scheduled' : 'pending',
      scheduledAt: params.scheduledDate
        ? new Date(params.scheduledDate)
        : undefined,
    } as DeepPartial<UpPostEntity>);
    const saved = await this.postRepo.save(entity);

    try {
      const result = await this.client.uploadPhotos({
        title: params.title,
        user,
        platforms: params.platforms,
        photoUrls: params.photoUrls,
        photoBuffers: params.photoBuffers,
        caption: params.caption,
        scheduledDate: params.scheduledDate,
        asyncUpload: true,
        addToQueue: params.addToQueue,
        timezone: params.timezone,
      });

      saved.requestId = result.request_id;
      saved.status = 'processing';
      await this.postRepo.save(saved);
      return { localId: saved.id, ...result };
    } catch (err: unknown) {
      saved.status = 'error';
      saved.errorMessage = err instanceof Error ? err.message : String(err);
      await this.postRepo.save(saved);
      throw err;
    }
  }

  async uploadText(params: {
    user?: string;
    platforms: string[];
    text: string;
    title?: string;
    scheduledDate?: string;
    addToQueue?: boolean;
  }) {
    const user = params.user ?? this.client.profileUsername;
    if (!user) throw new Error('user is required (not configured)');
    const entity = this.postRepo.create({
      mediaType: 'text',
      title: params.title,
      caption: params.text,
      platforms: params.platforms,
      profileUsername: user,
      status: params.scheduledDate ? 'scheduled' : 'pending',
      scheduledAt: params.scheduledDate
        ? new Date(params.scheduledDate)
        : undefined,
    } as DeepPartial<UpPostEntity>);
    const saved = await this.postRepo.save(entity);

    try {
      const result = (await this.client.uploadText({
        user,
        platforms: params.platforms,
        text: params.text,
        title: params.title,
        scheduledDate: params.scheduledDate,
        asyncUpload: true,
        addToQueue: params.addToQueue,
      })) as { request_id?: string | null; job_id?: string | null };

      saved.requestId = result.request_id ?? null;
      saved.jobId = result.job_id ?? null;
      saved.status = 'processing';
      await this.postRepo.save(saved);

      return {
        localId: saved.id,
        success: true,
        request_id: result.request_id ?? null,
        requestId: result.request_id ?? null,
      };
    } catch (err: unknown) {
      saved.status = 'error';
      saved.errorMessage = err instanceof Error ? err.message : String(err);
      await this.postRepo.save(saved);
      throw err;
    }
  }

  /** Document upload (LinkedIn carousel). Creates + persists local record. */
  async uploadDocument(params: {
    user?: string;
    platforms: string[];
    documentUrl?: string;
    documentBuffer?: Buffer;
    documentFilename?: string;
    title: string;
    caption?: string;
    scheduledDate?: string;
    addToQueue?: boolean;
  }) {
    const nonLinkedin = params.platforms.filter((p) => p !== 'linkedin');
    if (nonLinkedin.length > 0 || params.platforms.length === 0) {
      throw new PublisherValidationError(
        'INVALID_PLATFORMS',
        'Document uploads are only supported for platform "linkedin"',
      );
    }

    const user = params.user ?? this.client.profileUsername;
    if (!user) throw new Error('profileUsername is required (not configured)');

    const entity = this.postRepo.create({
      mediaType: 'document',
      title: params.title,
      caption: params.caption,
      platforms: params.platforms,
      profileUsername: user,
      mediaUrl: params.documentUrl,
      status: params.scheduledDate ? 'scheduled' : 'pending',
      scheduledAt: params.scheduledDate
        ? new Date(params.scheduledDate)
        : undefined,
    } as unknown as DeepPartial<UpPostEntity>);
    const saved = await this.postRepo.save(entity);

    try {
      const result = await this.client.uploadDocument({
        user,
        platforms: params.platforms,
        documentUrl: params.documentUrl,
        documentBuffer: params.documentBuffer,
        documentFilename: params.documentFilename,
        title: params.title,
        caption: params.caption,
        scheduledDate: params.scheduledDate,
        asyncUpload: true,
        addToQueue: params.addToQueue,
      });

      saved.requestId = result.request_id ?? null;
      saved.jobId = result.job_id ?? null;
      saved.status = 'processing';
      await this.postRepo.save(saved);

      return {
        localId: saved.id,
        success: true,
        request_id: result.request_id ?? null,
        requestId: result.request_id ?? null,
      };
    } catch (err: unknown) {
      saved.status = 'error';
      saved.errorMessage = err instanceof Error ? err.message : String(err);
      await this.postRepo.save(saved);
      throw err;
    }
  }

  async checkStatus(identifier: { requestId?: string; jobId?: string }) {
    const result = await this.client.getUploadStatus(identifier);

    // Sync local DB if we have a matching record
    const conditions: Array<Record<string, string>> = [];
    if (identifier.requestId)
      conditions.push({ requestId: identifier.requestId });
    if (identifier.jobId) conditions.push({ jobId: identifier.jobId });

    if (conditions.length > 0) {
      const local = await this.postRepo.findOne({
        where: conditions,
      });
      if (local) {
        if (result.status === 'completed' || result.success) {
          local.status = 'success';
          local.publishedAt = new Date();
          local.results = result.results ?? null;
        } else if (result.status === 'error' || result.error) {
          local.status = 'error';
          local.errorMessage = result.error ?? result.message ?? null;
        }
        await this.postRepo.save(local);
      }
    }

    return result;
  }

  async getHistory() {
    return this.client.getUploadHistory();
  }

  async getLocalPosts() {
    return this.postRepo.find({ order: { createdAt: 'DESC' }, take: 100 });
  }
}
