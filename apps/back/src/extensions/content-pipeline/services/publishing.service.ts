import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ContentPipelineDraftEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/draft.entity';
import { ContentPipelineProjectEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/project.entity';
import { BlogPostsService } from '@ext/cms/blog/posts/posts.service';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';
import type { UploadResponse } from '@ext/upload-post/services/upload-post-client.service';

interface SocialVariant {
  platform: string;
  mediaType: 'image' | 'video' | 'text' | 'carousel';
  caption: string;
  hashtags: string[];
  mediaPrompt: string;
}

interface UploadPostResult {
  request_id?: string;
  id?: string;
}

export interface PublishResult {
  blogPostId?: string;
  blogPostUrl?: string;
  socialPosts: Array<{
    platform: string;
    uploadPostId?: string;
    scheduledAt?: string;
    status: 'scheduled' | 'failed' | 'skipped';
    error?: string;
  }>;
}

/**
 * Publishes a draft to the CMS (blog) and schedules social posts via
 * Upload-Post. Both dependencies are optional — they are resolved at
 * runtime via ModuleRef. If either extension is not loaded, that
 * publish channel is skipped gracefully.
 */
@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);
  private blogPostsService: BlogPostsService | null | undefined;
  private uploadPostClient: UploadPostClientService | null | undefined;

  constructor(private readonly moduleRef: ModuleRef) {}

  /** Lazily resolve the CMS BlogPostsService if the cms extension is loaded. */
  private getBlogPostsService(): BlogPostsService | null {
    if (this.blogPostsService !== undefined)
      return this.blogPostsService ?? null;
    try {
      this.blogPostsService = this.moduleRef.get(BlogPostsService, {
        strict: false,
      });
    } catch {
      this.blogPostsService = null;
    }
    return this.blogPostsService ?? null;
  }

  /** Lazily resolve the UploadPostClientService if upload-post is loaded. */
  private getUploadPostClient(): UploadPostClientService | null {
    if (this.uploadPostClient !== undefined)
      return this.uploadPostClient ?? null;
    try {
      this.uploadPostClient = this.moduleRef.get(UploadPostClientService, {
        strict: false,
      });
    } catch {
      this.uploadPostClient = null;
    }
    return this.uploadPostClient ?? null;
  }

  get hasCms(): boolean {
    const svc = this.getBlogPostsService();
    return !!svc && typeof svc.create === 'function';
  }

  get hasUploadPost(): boolean {
    const svc = this.getUploadPostClient();
    return !!svc && typeof svc.uploadPhotos === 'function';
  }

  async publish(
    draft: ContentPipelineDraftEntity,
    project: ContentPipelineProjectEntity,
  ): Promise<PublishResult> {
    const result: PublishResult = { socialPosts: [] };

    // ─── 1. Publish to CMS blog ─────────────────────────────────────────
    const cmsCfg = (project.cmsConfig ?? {}) as {
      enabled?: boolean;
      categoryId?: string;
      authorUserId?: string;
      autoPublish?: boolean;
    };

    if (cmsCfg.enabled && this.hasCms) {
      try {
        const blogPosts = this.getBlogPostsService();
        if (!blogPosts) {
          this.logger.warn(
            'CMS extension not available — skipping blog publish',
          );
          return result;
        }
        const seo = (draft.seoMetadata ?? {}) as {
          slug?: string;
          metaTitle?: string;
        };
        const slug = seo.slug
          ? `/${seo.slug}`
          : `/${this.slugify(project.name)}-${draft.id.slice(0, 8)}`;

        const created = await blogPosts.create({
          slug,
          author: cmsCfg.authorUserId,
          categoryId: cmsCfg.categoryId,
          isPublished: cmsCfg.autoPublish !== false,
        });

        result.blogPostId = created?.id;
        result.blogPostUrl = created?.slug ? `/blog${created.slug}` : undefined;
        this.logger.log(
          `Published draft ${draft.id} to CMS as post ${created?.id}`,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`CMS publish failed for draft ${draft.id}: ${msg}`);
      }
    } else if (!cmsCfg.enabled) {
      this.logger.debug(
        `Project "${project.name}" CMS disabled — skipping blog publish`,
      );
    } else {
      this.logger.warn('CMS extension not available — skipping blog publish');
    }

    // ─── 2. Schedule social posts via Upload-Post ──────────────────────
    const socialCfg = (project.socialConfig ?? {}) as {
      platforms?: string[];
      profileUsername?: string;
      postingSchedule?: string;
    };
    const variants = (draft.socialVariants ?? []) as unknown as SocialVariant[];

    if (
      this.hasUploadPost &&
      socialCfg.profileUsername &&
      variants.length > 0
    ) {
      const uploadPost = this.getUploadPostClient();
      if (!uploadPost) {
        this.logger.warn(
          'Upload-Post extension not available — skipping social publish',
        );
        return result;
      }
      const user = socialCfg.profileUsername;

      for (const variant of variants) {
        try {
          const platforms = [variant.platform];
          const isVideo = variant.mediaType === 'video';
          const scheduledAt = socialCfg.postingSchedule ?? undefined;

          let postResult: UploadPostResult | undefined;
          if (isVideo) {
            postResult = await uploadPost.uploadVideo({
              title: variant.caption.slice(0, 100),
              user,
              platforms,
              caption: variant.caption,
              scheduledDate: scheduledAt,
              asyncUpload: true,
            });
          } else if (variant.mediaType === 'text') {
            postResult = (await uploadPost.uploadText({
              user,
              platforms,
              text: variant.caption,
              scheduledDate: scheduledAt,
              asyncUpload: true,
            })) as UploadResponse;
          } else {
            postResult = await uploadPost.uploadPhotos({
              user,
              platforms,
              caption: variant.caption,
              scheduledDate: scheduledAt,
              asyncUpload: true,
            });
          }

          result.socialPosts.push({
            platform: variant.platform,
            uploadPostId: postResult?.request_id ?? postResult?.id,
            scheduledAt,
            status: 'scheduled',
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Upload-Post schedule failed for ${variant.platform}: ${msg}`,
          );
          result.socialPosts.push({
            platform: variant.platform,
            status: 'failed',
            error: msg,
          });
        }
      }
    } else {
      for (const variant of variants) {
        result.socialPosts.push({
          platform: variant.platform,
          status: 'skipped',
        });
      }
      if (!this.hasUploadPost) {
        this.logger.warn(
          'Upload-Post extension not available — skipping social publish',
        );
      }
    }

    this.logger.log(
      `Publish draft ${draft.id}: blog=${!!result.blogPostId}, social=${result.socialPosts.filter((s) => s.status === 'scheduled').length} scheduled`,
    );

    return result;
  }

  private slugify(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
