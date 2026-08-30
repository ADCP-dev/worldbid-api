import { Injectable, Inject, Logger, HttpException } from '@nestjs/common';
import { UPLOAD_POST_PROVIDER } from '@ext/upload-post/upload-post.provider';
import { UploadPostConfig } from '@ext/upload-post/config/upload-post-config.type';

// ─── Upload-Post API response interfaces ──────────────────────────────
// Shapes traced from consuming services (upload.service.ts, analytics.service.ts,
// weekly-report.service.ts, autodm.service.ts) and frontend composables.

export interface UploadResponse {
  request_id: string;
  job_id?: string | null;
  [key: string]: unknown;
}

export interface UploadStatusResponse {
  status?: string;
  success?: boolean;
  error?: string;
  message?: string;
  results?: Record<
    string,
    { success: boolean; url?: string; error?: string; publishId?: string }
  >;
  [key: string]: unknown;
}

export interface PlatformMetrics {
  followers?: number;
  reach?: number;
  views?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  profileViews?: number;
  reach_timeseries?: Array<{ date: string; value: number }>;
}

export type AnalyticsResponse = Record<string, PlatformMetrics | unknown>;

export interface ScheduledPost {
  job_id: string;
  scheduled_date: string;
  title?: string;
  caption?: string;
  platforms?: string[];
  media_type?: string;
  status?: string;
}

export interface ScheduledPostsResponse {
  posts: ScheduledPost[];
  [key: string]: unknown;
}

export interface AutodmStartResponse {
  monitor_id?: string;
  id?: string;
  [key: string]: unknown;
}

export interface AutodmMonitor {
  monitor_id: string;
  post_url?: string;
  reply_message?: string;
  status: 'running' | 'paused' | 'stopped' | 'expired';
  dms_sent?: number;
  expires_at?: string;
  trigger_keywords?: string[];
}

export interface AutodmStatusResponse {
  monitors?: AutodmMonitor[];
  [key: string]: unknown;
}

export interface AutodmLog {
  timestamp?: string;
  username?: string;
  comment?: string;
  dm_sent?: boolean;
}

export interface AutodmLogsResponse {
  logs?: AutodmLog[];
  [key: string]: unknown;
}

export const DOCUMENT_PLATFORMS = ['linkedin'] as const;

export interface UploadDocumentParams {
  user: string;
  platforms: string[];
  documentUrl?: string;
  documentBuffer?: Buffer;
  documentFilename?: string;
  title: string;
  caption?: string;
  scheduledDate?: string;
  asyncUpload?: boolean;
  addToQueue?: boolean;
  linkedinPageId?: string;
}

export type UploadDocumentResponse = UploadResponse & {
  results?: Record<string, { success: boolean; document_urn?: string }>;
};

export type PostActionResponse = {
  success?: boolean;
  request_id?: string;
  message?: string;
  [key: string]: unknown;
};

export type UnifiedCommentsResponse = {
  comments?: Array<Record<string, unknown>>;
  pagination?: { next_cursor?: string };
  [key: string]: unknown;
};

export type UnifiedCommentPlatform =
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'linkedin';

export type UnpublishPlatform =
  | 'facebook'
  | 'youtube'
  | 'x'
  | 'linkedin'
  | 'threads';

/**
 * Thin HTTP wrapper around the Upload-Post REST API.
 * Every method maps 1:1 to an endpoint documented in https://docs.upload-post.com/llm.txt.
 * Throws HttpException with the upstream status + message on non-2xx.
 */
@Injectable()
export class UploadPostClientService {
  private readonly logger = new Logger(UploadPostClientService.name);
  private readonly cfg: UploadPostConfig | null;
  private readonly baseUrl: string;

  constructor(@Inject(UPLOAD_POST_PROVIDER) cfg: UploadPostConfig | null) {
    this.cfg = cfg;
    this.baseUrl = cfg?.apiUrl ?? 'https://api.upload-post.com';
  }

  get isConfigured(): boolean {
    return !!this.cfg?.apiKey;
  }

  get profileUsername(): string | undefined {
    return this.cfg?.profileUsername;
  }

  // ─── Internal fetch helper ─────────────────────────────────────────────

  private async request<T = unknown>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    opts: {
      body?: Record<string, unknown>;
      query?: Record<string, string | boolean | number | undefined>;
      formData?: FormData;
    } = {},
  ): Promise<T> {
    if (!this.isConfigured) {
      throw new HttpException('Upload-Post API key not configured', 503);
    }

    const url = new URL(`${this.baseUrl}${path}`);

    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Apikey ${this.cfg!.apiKey}`,
    };

    let res: Response;
    if (opts.formData) {
      res = await fetch(url.toString(), {
        method,
        headers,
        body: opts.formData,
      });
    } else if (opts.body) {
      headers['Content-Type'] = 'application/json';
      res = await fetch(url.toString(), {
        method,
        headers,
        body: JSON.stringify(opts.body),
      });
    } else {
      res = await fetch(url.toString(), { method, headers });
    }

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const message =
        (data !== null && typeof data === 'object' && 'message' in data
          ? String((data as { message: unknown }).message)
          : null) ?? text;
      this.logger.error(
        `Upload-Post API ${method} ${path} → ${res.status}: ${message}`,
      );
      throw new HttpException(message, res.status);
    }

    return data as T;
  }

  // ─── Upload endpoints ─────────────────────────────────────────────────

  async uploadVideo(params: {
    title: string;
    user: string;
    platforms: string[];
    videoUrl?: string;
    videoBuffer?: Buffer;
    videoFilename?: string;
    caption?: string;
    scheduledDate?: string;
    asyncUpload?: boolean;
    addToQueue?: boolean;
    timezone?: string;
    thumbUrl?: string;
    facebookMediaType?: string;
    youtubeCategory?: string;
    youtubeTags?: string[];
    pinterestBoard?: string;
    redditSubreddit?: string;
    redditTitle?: string;
    blueskyLanguage?: string;
  }): Promise<UploadResponse> {
    const fd = new FormData();
    fd.append('title', params.title);
    fd.append('user', params.user);
    for (const p of params.platforms) fd.append('platform[]', p);
    if (params.caption) fd.append('caption', params.caption);
    if (params.scheduledDate) fd.append('scheduled_date', params.scheduledDate);
    if (params.asyncUpload) fd.append('async_upload', 'true');
    if (params.addToQueue) fd.append('add_to_queue', 'true');
    if (params.timezone) fd.append('timezone', params.timezone);
    if (params.thumbUrl) fd.append('thumb_url', params.thumbUrl);
    if (params.facebookMediaType)
      fd.append('facebook_media_type', params.facebookMediaType);
    if (params.youtubeCategory)
      fd.append('youtube_category', params.youtubeCategory);
    if (params.youtubeTags)
      for (const t of params.youtubeTags) fd.append('youtube_tags[]', t);
    if (params.pinterestBoard)
      fd.append('pinterest_board', params.pinterestBoard);
    if (params.redditSubreddit)
      fd.append('reddit_subreddit', params.redditSubreddit);
    if (params.redditTitle) fd.append('reddit_title', params.redditTitle);
    if (params.blueskyLanguage)
      fd.append('bluesky_language', params.blueskyLanguage);

    if (params.videoUrl) {
      fd.append('video', params.videoUrl);
    } else if (params.videoBuffer && params.videoFilename) {
      fd.append(
        'video',
        new Blob([params.videoBuffer], { type: 'video/mp4' }),
        params.videoFilename,
      );
    }

    return this.request<UploadResponse>('POST', '/api/upload', {
      formData: fd,
    });
  }

  async uploadPhotos(params: {
    title?: string;
    user: string;
    platforms: string[];
    photoUrls?: string[];
    photoBuffers?: Array<{ buffer: Buffer; filename: string }>;
    caption?: string;
    scheduledDate?: string;
    asyncUpload?: boolean;
    addToQueue?: boolean;
    timezone?: string;
  }): Promise<UploadResponse> {
    const fd = new FormData();
    if (params.title) fd.append('title', params.title);
    fd.append('user', params.user);
    for (const p of params.platforms) fd.append('platform[]', p);
    if (params.caption) fd.append('caption', params.caption);
    if (params.scheduledDate) fd.append('scheduled_date', params.scheduledDate);
    if (params.asyncUpload) fd.append('async_upload', 'true');
    if (params.addToQueue) fd.append('add_to_queue', 'true');
    if (params.timezone) fd.append('timezone', params.timezone);

    if (params.photoUrls) {
      for (const url of params.photoUrls) fd.append('photos[]', url);
    } else if (params.photoBuffers) {
      for (const p of params.photoBuffers) {
        fd.append(
          'photos[]',
          new Blob([p.buffer], { type: 'image/jpeg' }),
          p.filename,
        );
      }
    }

    return this.request<UploadResponse>('POST', '/api/upload_photos', {
      formData: fd,
    });
  }

  async uploadText(params: {
    user: string;
    platforms: string[];
    text: string;
    title?: string;
    scheduledDate?: string;
    asyncUpload?: boolean;
    addToQueue?: boolean;
    timezone?: string;
  }): Promise<UploadResponse> {
    const fd = new FormData();
    fd.append('user', params.user);
    for (const p of params.platforms) fd.append('platform[]', p);
    fd.append('title', params.text);
    if (params.scheduledDate) fd.append('scheduled_date', params.scheduledDate);
    if (params.asyncUpload !== false) fd.append('async_upload', 'true');
    if (params.addToQueue) fd.append('add_to_queue', 'true');
    if (params.timezone) fd.append('timezone', params.timezone);
    return this.request<UploadResponse>('POST', '/api/upload_text', {
      formData: fd,
    });
  }

  /**
   * Upload a document (PDF/PPT/DOC) as a LinkedIn native document post.
   * Upstream: POST /api/upload_document — LinkedIn-only (validated here).
   */
  async uploadDocument(
    params: UploadDocumentParams,
  ): Promise<UploadDocumentResponse> {
    const nonLinkedin = params.platforms.filter(
      (p) => !(DOCUMENT_PLATFORMS as readonly string[]).includes(p),
    );
    if (nonLinkedin.length > 0 || params.platforms.length === 0) {
      throw new HttpException(
        'Document uploads are only supported for platform "linkedin"',
        400,
      );
    }

    const fd = new FormData();
    fd.append('user', params.user);
    for (const p of params.platforms) fd.append('platform[]', p);
    fd.append('title', params.title);
    if (params.caption) fd.append('description', params.caption);
    if (params.scheduledDate) fd.append('scheduled_date', params.scheduledDate);
    if (params.asyncUpload) fd.append('async_upload', 'true');
    if (params.addToQueue) fd.append('add_to_queue', 'true');
    if (params.linkedinPageId)
      fd.append('target_linkedin_page_id', params.linkedinPageId);

    if (params.documentUrl) {
      fd.append('document', params.documentUrl);
    } else if (params.documentBuffer && params.documentFilename) {
      fd.append(
        'document',
        new Blob([params.documentBuffer], {
          type: 'application/octet-stream',
        }),
        params.documentFilename,
      );
    }

    return this.request<UploadDocumentResponse>(
      'POST',
      '/api/upload_document',
      {
        formData: fd,
      },
    );
  }

  /** Retry failed platforms of a previous upload. POST /api/uploadposts/posts/retry */
  async retryUpload(identifier: {
    requestId?: string;
    jobId?: string;
  }): Promise<PostActionResponse> {
    return this.request<PostActionResponse>(
      'POST',
      '/api/uploadposts/posts/retry',
      {
        body: {
          request_id: identifier.requestId,
          job_id: identifier.jobId,
        },
      },
    );
  }

  /** Unpublish (delete) a published post. POST /api/uploadposts/posts/unpublish */
  async unpublishPost(params: {
    platform: UnpublishPlatform;
    postId: string;
    user?: string;
  }): Promise<PostActionResponse> {
    const user = params.user ?? this.cfg?.profileUsername;
    if (!user) {
      throw new HttpException(
        'user is required for unpublish (no profileUsername configured)',
        400,
      );
    }
    return this.request<PostActionResponse>(
      'POST',
      '/api/uploadposts/posts/unpublish',
      {
        body: {
          platform: params.platform,
          user,
          post_id: params.postId,
        },
      },
    );
  }

  // ─── Unified comments (multi-platform) ────────────────────────────────

  async listComments(params: {
    user: string;
    platform?: string;
    postId?: string;
    postUrl?: string;
    limit?: number;
    after?: string;
  }): Promise<UnifiedCommentsResponse> {
    return this.request<UnifiedCommentsResponse>(
      'GET',
      '/api/uploadposts/comments',
      {
        query: {
          user: params.user,
          platform: params.platform,
          post_id: params.postId,
          post_url: params.postUrl,
          limit: params.limit,
          after: params.after,
        },
      },
    );
  }

  async createComment(params: {
    platform: UnifiedCommentPlatform;
    user: string;
    message: string;
    commentId?: string;
    postId?: string;
    postUrl?: string;
  }): Promise<PostActionResponse> {
    return this.request<PostActionResponse>(
      'POST',
      '/api/uploadposts/comments/create',
      {
        body: {
          platform: params.platform,
          user: params.user,
          message: params.message,
          comment_id: params.commentId,
          post_id: params.postId,
          post_url: params.postUrl,
        },
      },
    );
  }

  async deleteComment(params: {
    platform: UnifiedCommentPlatform;
    user: string;
    commentId: string;
    postId?: string;
  }): Promise<PostActionResponse> {
    return this.request<PostActionResponse>(
      'POST',
      '/api/uploadposts/comments/delete',
      {
        body: {
          platform: params.platform,
          user: params.user,
          comment_id: params.commentId,
          post_id: params.postId,
        },
      },
    );
  }

  async getUploadStatus(identifier: {
    requestId?: string;
    jobId?: string;
  }): Promise<UploadStatusResponse> {
    return this.request<UploadStatusResponse>(
      'GET',
      '/api/uploadposts/status',
      {
        query: {
          request_id: identifier.requestId,
          job_id: identifier.jobId,
        },
      },
    );
  }

  async getUploadHistory(): Promise<unknown> {
    return this.request('GET', '/api/uploadposts/history');
  }

  // ─── Schedule endpoints ───────────────────────────────────────────────

  async getScheduledPosts(): Promise<ScheduledPostsResponse> {
    return this.request<ScheduledPostsResponse>(
      'GET',
      '/api/uploadposts/schedule',
    );
  }

  async updateScheduledPost(
    jobId: string,
    updates: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request('PATCH', `/api/uploadposts/schedule/${jobId}`, {
      body: updates,
    });
  }

  async deleteScheduledPost(jobId: string): Promise<unknown> {
    return this.request('DELETE', `/api/uploadposts/schedule/${jobId}`);
  }

  // ─── Analytics endpoints ──────────────────────────────────────────────

  async getAnalytics(
    profileUsername: string,
    platforms: string[],
  ): Promise<AnalyticsResponse> {
    return this.request<AnalyticsResponse>(
      'GET',
      `/api/analytics/${profileUsername}`,
      {
        query: { platforms: platforms.join(',') },
      },
    );
  }

  async getTotalImpressions(profileUsername: string): Promise<unknown> {
    return this.request(
      'GET',
      `/api/uploadposts/total-impressions/${profileUsername}`,
    );
  }

  async getPostAnalytics(requestId: string): Promise<unknown> {
    return this.request('GET', `/api/uploadposts/post-analytics/${requestId}`);
  }

  async getPlatformMetrics(): Promise<unknown> {
    return this.request('GET', '/api/uploadposts/platform-metrics');
  }

  // ─── AutoDM endpoints ─────────────────────────────────────────────────

  async startAutodmMonitor(params: {
    postUrl: string;
    replyMessage: string;
    profileUsername: string;
    monitoringInterval?: number;
    triggerKeywords?: string[];
  }): Promise<AutodmStartResponse> {
    return this.request<AutodmStartResponse>(
      'POST',
      '/api/uploadposts/autodms/start',
      { body: params },
    );
  }

  async getAutodmStatus(
    includeInactive = false,
  ): Promise<AutodmStatusResponse> {
    return this.request<AutodmStatusResponse>(
      'GET',
      '/api/uploadposts/autodms/status',
      {
        query: { include_inactive: includeInactive },
      },
    );
  }

  async getAutodmLogs(monitorId: string): Promise<AutodmLogsResponse> {
    return this.request<AutodmLogsResponse>(
      'GET',
      '/api/uploadposts/autodms/logs',
      { query: { monitor_id: monitorId } },
    );
  }

  async pauseAutodmMonitor(monitorId: string): Promise<unknown> {
    return this.request('POST', '/api/uploadposts/autodms/pause', {
      body: { monitor_id: monitorId },
    });
  }

  async resumeAutodmMonitor(monitorId: string): Promise<unknown> {
    return this.request('POST', '/api/uploadposts/autodms/resume', {
      body: { monitor_id: monitorId },
    });
  }

  async stopAutodmMonitor(monitorId: string): Promise<unknown> {
    return this.request('POST', '/api/uploadposts/autodms/stop', {
      body: { monitor_id: monitorId },
    });
  }

  async deleteAutodmMonitor(monitorId: string): Promise<unknown> {
    return this.request('POST', '/api/uploadposts/autodms/delete', {
      body: { monitor_id: monitorId },
    });
  }

  // ─── Webhook configuration ────────────────────────────────────────────

  async configureWebhooks(params: {
    webhookUrl: string;
    events?: Record<string, boolean>;
    telegramChatId?: string;
  }): Promise<unknown> {
    return this.request('POST', '/api/uploadposts/users/notifications', {
      body: params,
    });
  }

  // ─── Queue endpoints ──────────────────────────────────────────────────

  async getQueuePreview(): Promise<unknown> {
    return this.request('GET', '/api/uploadposts/queue/preview');
  }

  async getQueueNextSlot(): Promise<unknown> {
    return this.request('GET', '/api/uploadposts/queue/next-slot');
  }

  async getQueueSettings(): Promise<unknown> {
    return this.request('GET', '/api/uploadposts/queue/settings');
  }

  async updateQueueSettings(
    settings: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request('POST', '/api/uploadposts/queue/settings', {
      body: settings,
    });
  }

  // ─── Platform metadata ────────────────────────────────────────────────

  async getFacebookPages(): Promise<unknown> {
    return this.request('GET', '/api/uploadposts/facebook/pages');
  }

  async getLinkedinPages(): Promise<unknown> {
    return this.request('GET', '/api/uploadposts/linkedin/pages');
  }

  async getPinterestBoards(): Promise<unknown> {
    return this.request('GET', '/api/uploadposts/pinterest/boards');
  }

  async getGoogleBusinessLocations(): Promise<unknown> {
    return this.request('GET', '/api/uploadposts/google-business/locations');
  }

  async selectGoogleBusinessLocation(locationId: string): Promise<unknown> {
    return this.request(
      'POST',
      '/api/uploadposts/google-business/locations/select',
      {
        body: { location_id: locationId },
      },
    );
  }

  async getRedditDetailedPost(postId: string): Promise<unknown> {
    return this.request(
      'GET',
      `/api/uploadposts/reddit/detailed-posts/${postId}`,
    );
  }

  // ─── Instagram endpoints ──────────────────────────────────────────────

  async getInstagramMedia(): Promise<unknown> {
    return this.request('GET', '/api/uploadposts/media');
  }

  async getInstagramComments(postUrl: string): Promise<unknown> {
    return this.request('GET', '/api/uploadposts/comments', {
      query: { post_url: postUrl },
    });
  }

  async replyToInstagramComment(
    commentId: string,
    message: string,
  ): Promise<unknown> {
    return this.request('POST', '/api/uploadposts/comments/reply', {
      body: { comment_id: commentId, message },
    });
  }

  async sendInstagramDm(params: {
    username: string;
    message: string;
  }): Promise<unknown> {
    return this.request('POST', '/api/uploadposts/dms/send', { body: params });
  }

  async getInstagramDmConversations(): Promise<unknown> {
    return this.request('GET', '/api/uploadposts/dms/conversations');
  }

  // ─── Account ──────────────────────────────────────────────────────────

  async getCurrentUser(): Promise<unknown> {
    return this.request('GET', '/api/uploadposts/me');
  }
}
