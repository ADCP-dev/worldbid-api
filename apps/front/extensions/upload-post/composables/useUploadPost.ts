/**
 * Composable for the Upload-Post extension.
 * Wraps all API calls to the backend extension endpoints.
 * All endpoints require admin role — the backend enforces @Roles(RoleEnum.admin).
 */

import type { ApiFetchOptions } from '@/extensions/upload-post/types';

export interface UploadPostScheduled {
  job_id: string;
  scheduled_date: string;
  title?: string;
  caption?: string;
  platforms?: string[];
  media_type?: string;
  status?: string;
}

export interface UploadPostAnalytics {
  [platform: string]: {
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
  };
}

export interface AutodmMonitor {
  monitor_id: string;
  post_url: string;
  reply_message: string;
  status: 'running' | 'paused' | 'stopped' | 'expired';
  dms_sent?: number;
  expires_at?: string;
}

export interface WeeklyReport {
  period: { start: string; end: string };
  platforms: Array<{
    platform: string;
    followers: number;
    followersDelta: number;
    reach: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  }>;
  totalImpressions: number;
  topPlatform: string;
  generatedAt: string;
}

function useApi() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  const baseUrl = config.public.apiUrl as string;
  const apiPrefix = (config.public.apiPrefix as string) || '/api/v1';

  async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
    const headers: Record<string, string> = { ...(options.headers ?? {}) };
    if (authStore.token) {
      headers.Authorization = `Bearer ${authStore.token}`;
    }
    const res = await $fetch<T>(`${baseUrl}${apiPrefix}${path}`, {
      ...options,
      headers,
    });
    return res as T;
  }

  return { apiFetch };
}

export function useUploadPost() {
  const { apiFetch } = useApi();

  // ─── Upload ───────────────────────────────────────────────────────────

  async function uploadVideo(data: {
    title: string;
    platforms: string[];
    videoUrl?: string;
    caption?: string;
    scheduledDate?: string;
  }) {
    return apiFetch('/upload-post/upload/video', {
      method: 'POST',
      body: data,
    });
  }

  async function uploadPhotos(data: {
    title?: string;
    platforms: string[];
    photoUrls?: string[];
    caption?: string;
    scheduledDate?: string;
  }) {
    return apiFetch('/upload-post/upload/photo', {
      method: 'POST',
      body: data,
    });
  }

  async function uploadText(data: {
    user: string;
    platforms: string[];
    text: string;
    title?: string;
    scheduledDate?: string;
  }) {
    return apiFetch('/upload-post/upload/text', {
      method: 'POST',
      body: data,
    });
  }

  async function getUploadStatus(requestId?: string, jobId?: string) {
    const query: Record<string, string> = {};
    if (requestId) query.request_id = requestId;
    if (jobId) query.job_id = jobId;
    return apiFetch('/upload-post/upload/status', { query });
  }

  async function getLocalPosts() {
    return apiFetch('/upload-post/upload/local');
  }

  async function getUploadHistory() {
    return apiFetch('/upload-post/upload/history');
  }

  // ─── Webhooks ─────────────────────────────────────────────────────────

  async function configureWebhooks(data: {
    webhookUrl: string;
    telegramChatId?: string;
    events?: {
      uploadCompleted?: boolean;
      socialAccountConnected?: boolean;
      socialAccountDisconnected?: boolean;
      socialAccountReauthRequired?: boolean;
    };
  }) {
    return apiFetch('/upload-post/webhooks/configure', { method: 'POST', body: data });
  }

  // ─── Queue Settings ──────────────────────────────────────────────────

  async function getQueueSettings() {
    return apiFetch('/upload-post/queue/settings');
  }

  async function updateQueueSettings(data: {
    publishDays?: string;
    publishTime?: string;
    maxPerWeek?: number;
    skipWeekends?: boolean;
    timezone?: string;
  }) {
    return apiFetch('/upload-post/queue/settings', { method: 'POST', body: data });
  }

  // ─── Platforms (extended) ─────────────────────────────────────────────

  async function getGoogleBusinessLocations() {
    return apiFetch('/upload-post/platforms/google-business/locations');
  }

  async function selectGoogleBusinessLocation(locationId: string) {
    return apiFetch('/upload-post/platforms/google-business/locations/select', {
      method: 'POST',
      body: { locationId },
    });
  }

  async function getRedditDetailedPost(postId: string) {
    return apiFetch(`/upload-post/platforms/reddit/detailed-posts/${postId}`);
  }

  // ─── Instagram ─────────────────────────────────────────────────────────

  async function getInstagramMedia() {
    return apiFetch('/upload-post/instagram/media');
  }

  async function getInstagramComments(postUrl: string) {
    return apiFetch('/upload-post/instagram/comments', { query: { postUrl } });
  }

  async function replyInstagramComment(commentId: string, message: string) {
    return apiFetch('/upload-post/instagram/comments/reply', {
      method: 'POST',
      body: { commentId, message },
    });
  }

  async function sendInstagramDm(username: string, message: string) {
    return apiFetch('/upload-post/instagram/dms/send', {
      method: 'POST',
      body: { username, message },
    });
  }

  async function getInstagramConversations() {
    return apiFetch('/upload-post/instagram/dms/conversations');
  }

  // ─── Schedule ─────────────────────────────────────────────────────────

  async function getScheduled(): Promise<{ posts: UploadPostScheduled[] }> {
    return apiFetch('/upload-post/schedule');
  }

  async function updateScheduled(jobId: string, data: { scheduledDate?: string; title?: string; caption?: string }) {
    return apiFetch(`/upload-post/schedule/${jobId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async function cancelScheduled(jobId: string) {
    return apiFetch(`/upload-post/schedule/${jobId}`, { method: 'DELETE' });
  }

  // ─── Analytics ────────────────────────────────────────────────────────

  async function getAnalytics(profileUsername: string, platforms?: string[]): Promise<UploadPostAnalytics> {
    const query: Record<string, string> = {};
    if (platforms?.length) query.platforms = platforms.join(',');
    return apiFetch(`/upload-post/analytics/${profileUsername}`, { query });
  }

  async function getTotalImpressions(profileUsername: string) {
    return apiFetch(`/upload-post/analytics/total-impressions/${profileUsername}`);
  }

  async function getWeeklyReport(): Promise<WeeklyReport> {
    return apiFetch('/upload-post/weekly-report');
  }

  async function sendWeeklyReport(): Promise<WeeklyReport> {
    return apiFetch('/upload-post/weekly-report/send', { method: 'POST' });
  }

  // ─── AutoDM ───────────────────────────────────────────────────────────

  async function startAutodm(data: {
    postUrl: string;
    replyMessage: string;
    monitoringInterval?: number;
    triggerKeywords?: string[];
  }) {
    return apiFetch('/upload-post/autodms/start', { method: 'POST', body: data });
  }

  async function getAutodmStatus(includeInactive = false) {
    return apiFetch('/upload-post/autodms/status', {
      query: { include_inactive: includeInactive },
    });
  }

  async function getAutodmLogs(monitorId: string) {
    return apiFetch('/upload-post/autodms/logs', { query: { monitor_id: monitorId } });
  }

  async function pauseAutodm(monitorId: string) {
    return apiFetch('/upload-post/autodms/pause', { method: 'POST', body: { monitorId } });
  }

  async function resumeAutodm(monitorId: string) {
    return apiFetch('/upload-post/autodms/resume', { method: 'POST', body: { monitorId } });
  }

  async function stopAutodm(monitorId: string) {
    return apiFetch('/upload-post/autodms/stop', { method: 'POST', body: { monitorId } });
  }

  async function deleteAutodm(monitorId: string) {
    return apiFetch('/upload-post/autodms/delete', { method: 'POST', body: { monitorId } });
  }

  async function getLocalMonitors() {
    return apiFetch('/upload-post/autodms/local');
  }

  // ─── Queue ────────────────────────────────────────────────────────────

  async function getQueuePreview() {
    return apiFetch('/upload-post/queue/preview');
  }

  async function getQueueNextSlot() {
    return apiFetch('/upload-post/queue/next-slot');
  }

  // ─── Platforms ────────────────────────────────────────────────────────

  async function getFacebookPages() {
    return apiFetch('/upload-post/platforms/facebook/pages');
  }

  async function getLinkedinPages() {
    return apiFetch('/upload-post/platforms/linkedin/pages');
  }

  async function getPinterestBoards() {
    return apiFetch('/upload-post/platforms/pinterest/boards');
  }

  // ─── Content Ideas ─────────────────────────────────────────────────────

  async function getIdeas() {
    return apiFetch('/upload-post/ideas');
  }

  async function createIdea(data: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    platforms?: string[];
    tags?: string[];
    mediaUrl?: string;
    caption?: string;
    scheduledAt?: string;
  }) {
    return apiFetch('/upload-post/ideas', { method: 'POST', body: data });
  }

  async function updateIdea(id: string, data: Record<string, unknown>) {
    return apiFetch(`/upload-post/ideas/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteIdea(id: string) {
    return apiFetch(`/upload-post/ideas/${id}`, { method: 'DELETE' });
  }

  async function updateIdeaStatus(id: string, status: string, order?: number) {
    return apiFetch(`/upload-post/ideas/${id}/status`, {
      method: 'PATCH',
      body: { status, order },
    });
  }

  async function reorderIdeas(orderedIds: string[]) {
    return apiFetch('/upload-post/ideas/reorder', {
      method: 'POST',
      body: { orderedIds },
    });
  }

  // ─── Monthly Analytics ──────────────────────────────────────────────────

  async function getMonthlySummary(month: string) {
    return apiFetch(`/upload-post/monthly-analytics/summary/${month}`);
  }

  async function getMonthlyHistory(months = 12) {
    return apiFetch('/upload-post/monthly-analytics/history', { query: { months } });
  }

  async function getTopPosts(limit = 20) {
    return apiFetch('/upload-post/monthly-analytics/top-posts', { query: { limit } });
  }

  async function getTopPostsByMonth(month: string, limit = 20) {
    return apiFetch(`/upload-post/monthly-analytics/top-posts/${month}`, { query: { limit } });
  }

  return {
    uploadVideo,
    uploadPhotos,
    uploadText,
    getUploadStatus,
    getLocalPosts,
    getUploadHistory,
    // Webhooks
    configureWebhooks,
    // Queue
    getQueuePreview,
    getQueueNextSlot,
    getQueueSettings,
    updateQueueSettings,
    // Platforms
    getFacebookPages,
    getLinkedinPages,
    getPinterestBoards,
    getGoogleBusinessLocations,
    selectGoogleBusinessLocation,
    getRedditDetailedPost,
    // Instagram
    getInstagramMedia,
    getInstagramComments,
    replyInstagramComment,
    sendInstagramDm,
    getInstagramConversations,
    // Schedule
    getScheduled,
    updateScheduled,
    cancelScheduled,
    getAnalytics,
    getTotalImpressions,
    getWeeklyReport,
    sendWeeklyReport,
    startAutodm,
    getAutodmStatus,
    getAutodmLogs,
    pauseAutodm,
    resumeAutodm,
    stopAutodm,
    deleteAutodm,
    getLocalMonitors,
    // Content Ideas
    getIdeas,
    createIdea,
    updateIdea,
    deleteIdea,
    updateIdeaStatus,
    reorderIdeas,
    // Monthly Analytics
    getMonthlySummary,
    getMonthlyHistory,
    getTopPosts,
    getTopPostsByMonth,
  };
}