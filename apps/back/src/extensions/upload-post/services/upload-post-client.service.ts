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
  }): Promise<UploadResponse> {
    const fd = new FormData();
    if (params.title) fd.append('title', params.title);
    fd.append('user', params.user);
    for (const p of params.platforms) fd.append('platform[]', p);
    if (params.caption) fd.append('caption', params.caption);
    if (params.scheduledDate) fd.append('scheduled_date', params.scheduledDate);
    if (params.asyncUpload) fd.append('async_upload', 'true');

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
  }): Promise<unknown> {
    return this.request('POST', '/api/upload_text', {
      body: {
        user: params.user,
        platform: params.platforms,
        text: params.text,
        title: params.title,
        scheduled_date: params.scheduledDate,
        async_upload: params.asyncUpload ?? false,
      },
    });
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
