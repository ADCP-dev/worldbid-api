import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UploadService } from '@ext/upload-post/services/upload.service';
import { FilesService } from '@storage/files/files.service';
import { UpPostEntity } from '@ext/upload-post/infrastructure/persistence/entities/up-post.entity';

export type UpMediaType = 'video' | 'photos' | 'text' | 'document';

export interface PlatformCapability {
  aspectRatios: string[];
  mediaTypes: UpMediaType[];
  requiresDestination?: 'facebook_page' | 'linkedin_page' | 'pinterest_board';
}

export interface PublishRequest {
  mediaType: UpMediaType;
  platforms: string[];
  caption?: string;
  templateVars?: Record<string, string>;
  title?: string;
  mediaUrls?: string[];
  documentUrl?: string;
  documentBuffer?: Buffer;
  documentFilename?: string;
  storageFileIds?: string[];
  scheduledAt?: string;
  addToQueue?: boolean;
  profileUsername?: string;
  destinations?: {
    facebookPageId?: string;
    linkedinUrn?: string;
    pinterestBoard?: string;
  };
}

export interface PublishResult {
  requestId: string | null;
  localId: string;
}

export class PublisherValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PublisherValidationError';
    this.code = code;
  }
}

/** Capability presets per platform (single source of truth for gating). */
export const PLATFORM_CAPABILITIES: Record<string, PlatformCapability> = {
  tiktok: {
    aspectRatios: ['9:16', '1:1'],
    mediaTypes: ['video', 'photos'],
  },
  instagram: {
    aspectRatios: ['9:16', '1:1', '4:5'],
    mediaTypes: ['video', 'photos'],
  },
  youtube: {
    aspectRatios: ['16:9', '9:16', '1:1'],
    mediaTypes: ['video'],
  },
  facebook: {
    aspectRatios: ['9:16', '16:9', '1:1', '4:5'],
    mediaTypes: ['video', 'photos', 'text'],
    requiresDestination: 'facebook_page',
  },
  linkedin: {
    aspectRatios: ['16:9', '1:1', '4:5'],
    mediaTypes: ['video', 'photos', 'text', 'document'],
    requiresDestination: 'linkedin_page',
  },
  x: { aspectRatios: ['16:9', '1:1'], mediaTypes: ['video', 'photos', 'text'] },
  threads: {
    aspectRatios: ['9:16', '1:1', '4:5'],
    mediaTypes: ['video', 'photos', 'text'],
  },
  pinterest: {
    aspectRatios: ['9:16', '1:1', '2:3'],
    mediaTypes: ['video', 'photos'],
    requiresDestination: 'pinterest_board',
  },
  reddit: { aspectRatios: ['16:9'], mediaTypes: ['video', 'photos', 'text'] },
  bluesky: { aspectRatios: ['16:9', '1:1'], mediaTypes: ['text', 'photos'] },
};

const TEMPLATE_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Internal publish connector for other extensions (crm, cms, …).
 * Delegates dispatch to UploadService persisted flows. Idempotency:
 * an identical logical request (profile + mediaType + rendered caption +
 * schedule) whose dispatch already produced content returns the original
 * requestId without re-dispatching upstream.
 */
@Injectable()
export class UploadPostPublisherService {
  private readonly logger = new Logger(UploadPostPublisherService.name);

  constructor(
    private readonly uploadService: UploadService,
    @InjectRepository(UpPostEntity)
    private readonly postRepo: Repository<UpPostEntity>,
    @Optional() private readonly filesService?: FilesService,
  ) {}

  get presets(): Record<string, PlatformCapability> {
    return PLATFORM_CAPABILITIES;
  }

  /** Replaces `{{var}}` placeholders; missing vars render as '' with a warning. */
  renderTemplate(caption: string, vars: Record<string, string> = {}): string {
    const rendered = caption.replace(
      TEMPLATE_PATTERN,
      (match: string, key: string) => {
        if (!(key in vars)) {
          this.logger.warn(
            `renderTemplate: missing template var "${key}" — rendering as empty`,
          );
          return '';
        }
        return vars[key];
      },
    );
    return rendered.trim();
  }

  private async findExisting(
    req: PublishRequest,
    caption: string,
  ): Promise<UpPostEntity | null> {
    if (!req.profileUsername) return null;
    const candidates = await this.postRepo.find({
      where: {
        profileUsername: req.profileUsername,
        caption: caption ?? null,
      },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    return (
      candidates.find(
        (row) =>
          row.mediaType === req.mediaType &&
          (req.scheduledAt ?? null) ===
            (row.scheduledAt ? row.scheduledAt.toISOString() : null) &&
          (Boolean(row.requestId) || row.status === 'processing'),
      ) ?? null
    );
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const supported = new Set<UpMediaType>([
      'video',
      'photos',
      'text',
      'document',
    ]);
    if (!supported.has(req.mediaType)) {
      throw new PublisherValidationError(
        'UNSUPPORTED_MEDIA_TYPE',
        `Unknown mediaType: ${String(req.mediaType)}`,
      );
    }

    const caption = req.caption
      ? this.renderTemplate(req.caption, req.templateVars)
      : undefined;

    const existing = await this.findExisting(req, caption ?? '');
    if (existing) {
      return { requestId: existing.requestId, localId: existing.id };
    }

    if (req.mediaType === 'document') {
      const nonLinkedin = req.platforms.filter((p) => p !== 'linkedin');
      if (nonLinkedin.length > 0) {
        throw new PublisherValidationError(
          'INVALID_PLATFORMS',
          'Document uploads are LinkedIn-only',
        );
      }
    }

    const mediaUrls = await this.resolveMediaUrls(req);

    const shared = {
      caption,
      profileUsername: req.profileUsername,
      scheduledDate: req.scheduledAt,
      addToQueue: req.addToQueue,
    };

    switch (req.mediaType) {
      case 'video': {
        if (!req.title) {
          throw new PublisherValidationError(
            'REQUEST_INCOMPLETE',
            'title is required for video uploads',
          );
        }
        const result = await this.uploadService.uploadVideo({
          title: req.title,
          platforms: req.platforms,
          videoUrl: req.mediaUrls?.[0],
          ...shared,
          pinterestBoard: req.destinations?.pinterestBoard,
        });
        return this.toPublishResult(result);
      }
      case 'photos': {
        const photoUrls = this.withStorageUrls(req, mediaUrls);
        const result = await this.uploadService.uploadPhotos({
          title: req.title,
          platforms: req.platforms,
          photoUrls,
          ...shared,
          pinterestBoard: req.destinations?.pinterestBoard,
        });
        return this.toPublishResult(result);
      }
      case 'text': {
        if (!caption && !req.title) {
          throw new PublisherValidationError(
            'REQUEST_INCOMPLETE',
            'caption or title is required for text uploads',
          );
        }
        const result = await this.uploadService.uploadText({
          user: req.profileUsername ?? '',
          platforms: req.platforms,
          text: caption ?? req.title ?? '',
          title: req.title,
          scheduledDate: req.scheduledAt,
          addToQueue: req.addToQueue,
        });
        return this.toPublishResult(result);
      }
      case 'document': {
        const documentUrl = req.documentUrl ?? mediaUrls?.[0];
        if (!documentUrl && !req.documentBuffer) {
          throw new PublisherValidationError(
            'REQUEST_INCOMPLETE',
            'document requires a documentUrl, resolved mediaUrls or documentBuffer',
          );
        }
        const result = await this.uploadService.uploadDocument({
          user: req.profileUsername,
          platforms: req.platforms,
          documentUrl,
          documentBuffer: req.documentBuffer,
          documentFilename: req.documentFilename,
          title: req.title ?? 'Document',
          caption,
          scheduledDate: req.scheduledAt,
          addToQueue: req.addToQueue,
        });
        return this.toPublishResult(result);
      }
    }
  }

  private toPublishResult(result: {
    request_id?: string | null;
    requestId?: string | null;
    localId: string;
  }): PublishResult {
    const requestId = (result.request_id ?? result.requestId ?? null) as
      | string
      | null;
    return { requestId, localId: result.localId };
  }

  /** Merge storage-resolved URLs with any explicitly provided URLs. */
  private withStorageUrls(
    req: PublishRequest,
    resolved: string[] | undefined,
  ): string[] | undefined {
    const urls = [...(req.mediaUrls ?? []), ...(resolved ?? [])];
    return urls.length > 0 ? urls : undefined;
  }

  private async resolveMediaUrls(
    req: PublishRequest,
  ): Promise<string[] | undefined> {
    if (!req.storageFileIds || req.storageFileIds.length === 0) {
      return undefined;
    }
    if (!this.filesService) {
      throw new PublisherValidationError(
        'CONFIGURATION_ERROR',
        'storageFileIds provided but FilesService unavailable',
      );
    }
    const files = await this.filesService.findByIds(req.storageFileIds);
    return files.map((f) => f.path);
  }
}
