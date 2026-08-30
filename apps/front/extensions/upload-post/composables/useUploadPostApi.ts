import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';

/**
 * Upload-Post — TanStack Query hooks (design D8).
 *
 * All endpoints are admin-only (backend enforces RolesGuard). HTTP goes
 * through the central useApi() (auth header + 401 refresh). Query keys are
 * flat domain keys under ['up', ...] (design D8) and are invalidated after
 * each mutation.
 */

export const upKeys = {
  all: ['up'] as const,
  status: (requestId: string | null | undefined) =>
    ['up', 'status', requestId ?? 'none'] as const,
  history: ['up', 'history'] as const,
  local: ['up', 'local'] as const,
  schedule: ['up', 'schedule'] as const,
  analytics: (profile: string) => ['up', 'analytics', profile] as const,
  weeklyReport: ['up', 'weekly-report'] as const,
  conversations: ['up', 'dm-conversations'] as const,
  comments: ['up', 'comments'] as const,
  commentsFor: (postUrl: string) => ['up', 'comments', postUrl] as const,
  autodms: ['up', 'autodms'] as const,
  autodmLogs: (monitorId: string) => ['up', 'autodms', 'logs', monitorId] as const,
  queuePreview: ['up', 'queue-preview'] as const,
  queueNextSlot: ['up', 'queue-next-slot'] as const,
  queueSettings: ['up', 'queue-settings'] as const,
  ideas: ['up', 'ideas'] as const,
  webhooks: ['up', 'webhooks'] as const,
  me: ['up', 'me'] as const,
  facebookPages: ['up', 'platforms', 'facebook-pages'] as const,
  linkedinPages: ['up', 'platforms', 'linkedin', 'pages'] as const,
  pinterestBoards: ['up', 'platforms', 'pinterest', 'boards'] as const,
};

// ─── Upload dispatch + status polling ─────────────────────────────────

export interface UpDispatchPayload {
  mediaType: 'video' | 'photos' | 'text' | 'document';
  title?: string;
  platforms: string[];
  videoUrl?: string;
  photoUrls?: string[];
  text?: string;
  documentUrl?: string;
  documentFile?: File;
  caption?: string;
  scheduledDate?: string;
  addToQueue?: boolean;
}

interface DispatchResultShape {
  localId?: string;
  request_id?: string | null;
  requestId?: string | null;
  job_id?: string | null;
  success?: boolean;
}

function extractRequestId(res: DispatchResultShape): string | null {
  return res.requestId ?? res.request_id ?? null;
}

export function useUploadPostDispatchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: UpDispatchPayload,
    ): Promise<{ requestId: string | null; localId?: string }> => {
      const api = useApi();
      if (payload.documentFile) {
        const config = useRuntimeConfig();
        const auth = useAuthStore();
        const baseUrl = `${config.public.apiUrl}${config.public.apiPrefix}`;
        const fd = new FormData();
        for (const p of payload.platforms) fd.append('platforms[]', p);
        fd.append('title', payload.title ?? '');
        if (payload.caption) fd.append('caption', payload.caption);
        if (payload.scheduledDate)
          fd.append('scheduledDate', payload.scheduledDate);
        if (payload.addToQueue) fd.append('addToQueue', 'true');
        fd.append('file', payload.documentFile, payload.documentFile.name);
        const res = await fetch(`${baseUrl}/upload-post/upload/document`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${auth.token}` },
          body: fd,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text.slice(0, 300) || `Upload failed (${res.status})`);
        }
        const data = (await res.json()) as DispatchResultShape;
        return {
          requestId: extractRequestId(data),
          localId: data.localId,
        };
      }
      if (payload.mediaType === 'video') {
        const res = await api.post<DispatchResultShape>(
          '/upload-post/upload/video',
          {
            title: payload.title ?? '',
            platforms: payload.platforms,
            videoUrl: payload.videoUrl,
            caption: payload.caption,
            scheduledDate: payload.scheduledDate,
          },
        );
        return { requestId: extractRequestId(res), localId: res.localId };
      }
      if (payload.mediaType === 'photos') {
        const res = await api.post<DispatchResultShape>(
          '/upload-post/upload/photo',
          {
            title: payload.title,
            platforms: payload.platforms,
            photoUrls: payload.photoUrls,
            caption: payload.caption,
            scheduledDate: payload.scheduledDate,
          },
        );
        return { requestId: extractRequestId(res), localId: res.localId };
      }
      if (payload.mediaType === 'text') {
        const res = await api.post<DispatchResultShape>(
          '/upload-post/upload/text',
          {
            platforms: payload.platforms,
            text: payload.caption,
            title: payload.title,
            scheduledDate: payload.scheduledDate,
          },
        );
        return { requestId: extractRequestId(res), localId: res.localId };
      }
      const res = await api.post<DispatchResultShape>(
        '/upload-post/upload/document',
        {
          platforms: payload.platforms,
          title: payload.title,
          caption: payload.caption,
          scheduledDate: payload.scheduledDate,
          documentUrl: payload.documentUrl,
        },
      );
      return { requestId: extractRequestId(res), localId: res.localId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: upKeys.history });
      qc.invalidateQueries({ queryKey: upKeys.local });
    },
  });
}

export interface UpStatusPlatformResult {
  success?: boolean;
  post_id?: string | null;
  post_url?: string | null;
  error?: string | null;
}

export interface UpStatusResponse {
  request_id?: string | null;
  job_id?: string | null;
  status?: string;
  platforms?: Record<string, UpStatusPlatformResult>;
}

export function useUploadStatusQuery(
  requestId: MaybeRefOrGetter<string | null | undefined>,
) {
  return useQuery({
    queryKey: computed(() => upKeys.status(toValue(requestId))),
    enabled: computed(() => !!toValue(requestId)),
    refetchInterval: 4000,
    queryFn: () => {
      const api = useApi();
      return api.get<UpStatusResponse>('/upload-post/upload/status', {
        query: { requestId: toValue(requestId) ?? '' },
      });
    },
  });
}

export interface UpPostRecord {
  id: string;
  mediaType: string;
  title?: string | null;
  caption?: string | null;
  platforms?: string[] | null;
  profileUsername?: string | null;
  mediaUrl?: string | null;
  status: string;
  errorMessage?: string | null;
  requestId?: string | null;
  jobId?: string | null;
  scheduledAt?: string | null;
  platformResults?: Record<string, UpStatusPlatformResult> | null;
  createdAt: string;
}

export function useLocalPostsQuery() {
  return useQuery({
    queryKey: upKeys.local,
    queryFn: () => {
      const api = useApi();
      return api.get<UpPostRecord[]>('/upload-post/upload/local');
    },
  });
}

export function useRetryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { requestId?: string; jobId?: string }) => {
      const api = useApi();
      return api.post<unknown>('/upload-post/upload/actions/retry', vars);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: upKeys.history });
      qc.invalidateQueries({ queryKey: upKeys.local });
    },
  });
}

export function useUnpublishMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { platform: string; postId: string }) => {
      const api = useApi();
      return api.post<unknown>('/upload-post/upload/actions/unpublish', vars);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: upKeys.history });
      qc.invalidateQueries({ queryKey: upKeys.local });
    },
  });
}

// ─── Schedule ─────────────────────────────────────────────────────────

export interface UpScheduleJob {
  job_id: string;
  scheduled_date: string;
  title?: string | null;
  caption?: string | null;
  platforms?: string[] | null;
  media_type?: string | null;
  status?: string | null;
}

export function useScheduleQuery() {
  return useQuery({
    queryKey: upKeys.schedule,
    queryFn: () => {
      const api = useApi();
      return api.get<UpScheduleJob[]>('/upload-post/schedule');
    },
  });
}

export function useCancelScheduleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => {
      const api = useApi();
      return api.delete<unknown>(`/upload-post/schedule/${jobId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: upKeys.schedule }),
  });
}

export function useRescheduleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { jobId: string; scheduledDate: string }) => {
      const api = useApi();
      return api.patch<unknown>(`/upload-post/schedule/${vars.jobId}`, {
        scheduledDate: vars.scheduledDate,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: upKeys.schedule }),
  });
}

// ─── Analytics ────────────────────────────────────────────────────────

export interface UpReachPoint {
  date: string;
  value: number;
}

export interface UpAnalyticsPlatform {
  followers?: number;
  reach?: number;
  views?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  reach_timeseries?: UpReachPoint[];
}

export type UpAnalytics = Record<string, UpAnalyticsPlatform>;

export function useAnalyticsQuery(
  profileUsername: MaybeRefOrGetter<string | undefined>,
  platforms: MaybeRefOrGetter<string[] | undefined>,
) {
  return useQuery({
    queryKey: computed(() => [
      ...upKeys.analytics(toValue(profileUsername) ?? 'all'),
      toValue(platforms) ?? [],
    ]),
    enabled: computed(() => !!toValue(profileUsername)),
    queryFn: () => {
      const api = useApi();
      return api.get<UpAnalytics>(
        `/upload-post/analytics/${toValue(profileUsername)}`,
        { query: { platforms: (toValue(platforms) ?? []).join(',') } },
      );
    },
  });
}

export interface UpWeeklyReportPlatform {
  platform: string;
  followers: number;
  followersDelta: number;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface UpWeeklyReport {
  period: { start: string; end: string };
  platforms: UpWeeklyReportPlatform[];
  totalImpressions: number;
  topPlatform: string;
  generatedAt: string;
}

export function useWeeklyReportQuery() {
  return useQuery({
    queryKey: upKeys.weeklyReport,
    queryFn: () => {
      const api = useApi();
      return api.get<UpWeeklyReport>('/upload-post/weekly-report');
    },
  });
}

export function useSendWeeklyReportMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const api = useApi();
      return api.post<unknown>('/upload-post/weekly-report/send');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: upKeys.weeklyReport }),
  });
}

// ─── Instagram inbox ──────────────────────────────────────────────────

export interface UpDmMessage {
  id?: string;
  from?: string;
  text?: string;
  timestamp?: string | null;
}

export interface UpConversation {
  id?: string;
  username?: string;
  last_message?: string | null;
  last_message_at?: string | null;
  messages?: UpDmMessage[];
}

export function useDmConversationsQuery() {
  return useQuery({
    queryKey: upKeys.conversations,
    queryFn: () => {
      const api = useApi();
      return api.get<UpConversation[]>(
        '/upload-post/instagram/dms/conversations',
      );
    },
  });
}

export function useSendDmMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { username: string; message: string }) => {
      const api = useApi();
      return api.post<unknown>('/upload-post/instagram/dms/send', vars);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: upKeys.conversations }),
  });
}

export interface UpComment {
  id: string;
  username?: string;
  text?: string;
  created_at?: string | null;
  permalink?: string | null;
  replies?: UpComment[];
}

export function useInstagramCommentsQuery(
  postUrl: MaybeRefOrGetter<string>,
) {
  return useQuery({
    queryKey: computed(() => upKeys.commentsFor(toValue(postUrl))),
    enabled: computed(() => toValue(postUrl).length > 0),
    queryFn: () => {
      const api = useApi();
      return api.get<UpComment[]>('/upload-post/instagram/comments', {
        query: { postUrl: toValue(postUrl) },
      });
    },
  });
}

export function useInstagramCommentReplyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { commentId: string; message: string }) => {
      const api = useApi();
      return api.post<unknown>('/upload-post/instagram/comments/reply', vars);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: upKeys.comments }),
  });
}

export interface UpAutodmMonitor {
  monitor_id?: string;
  monitorId?: string;
  post_url?: string;
  postUrl?: string;
  reply_message?: string;
  replyMessage?: string;
  status?: 'running' | 'paused' | 'stopped' | 'expired';
  dms_sent?: number;
  dmsSent?: number;
  expires_at?: string;
  expiresAt?: string;
}

export function useAutodmStatusQuery() {
  return useQuery({
    queryKey: upKeys.autodms,
    queryFn: () => {
      const api = useApi();
      return api.get<UpAutodmMonitor[]>('/upload-post/autodms/status', {
        query: { includeInactive: true },
      });
    },
  });
}

export interface UpAutodmLog {
  timestamp?: string;
  level?: string;
  message?: string;
  event?: string;
}

export function useAutodmLogsQuery(monitorId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => upKeys.autodmLogs(toValue(monitorId) || 'none')),
    enabled: computed(() => toValue(monitorId).length > 0),
    queryFn: () => {
      const api = useApi();
      return api.get<UpAutodmLog[]>('/upload-post/autodms/logs', {
        query: { monitorId: toValue(monitorId) },
      });
    },
  });
}

export interface UpStartAutodmPayload {
  postUrl: string;
  replyMessage: string;
  monitoringInterval?: number;
  triggerKeywords?: string[];
}

export function useStartAutodmMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpStartAutodmPayload) => {
      const api = useApi();
      return api.post<unknown>('/upload-post/autodms/start', payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: upKeys.autodms }),
  });
}

export function useAutodmActionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      action: 'pause' | 'resume' | 'stop' | 'delete';
      monitorId: string;
    }) => {
      const api = useApi();
      return api.post<unknown>(`/upload-post/autodms/${vars.action}`, {
        monitorId: vars.monitorId,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: upKeys.autodms }),
  });
}

// ─── Queue ────────────────────────────────────────────────────────────

export interface UpQueueSettings {
  publishDays?: string;
  publishTime?: string;
  maxPerWeek?: number;
  skipWeekends?: boolean;
  timezone?: string;
}

export function useQueueSettingsQuery() {
  return useQuery({
    queryKey: upKeys.queueSettings,
    queryFn: () => {
      const api = useApi();
      return api.get<UpQueueSettings>('/upload-post/queue/settings');
    },
  });
}

export function useUpdateQueueSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpQueueSettings) => {
      const api = useApi();
      return api.post<unknown>('/upload-post/queue/settings', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: upKeys.queueSettings });
      qc.invalidateQueries({ queryKey: upKeys.queuePreview });
      qc.invalidateQueries({ queryKey: upKeys.queueNextSlot });
    },
  });
}

export function useQueuePreviewQuery() {
  return useQuery({
    queryKey: upKeys.queuePreview,
    queryFn: () => {
      const api = useApi();
      return api.get<unknown>('/upload-post/queue/preview');
    },
  });
}

export function useQueueNextSlotQuery() {
  return useQuery({
    queryKey: upKeys.queueNextSlot,
    queryFn: () => {
      const api = useApi();
      return api.get<unknown>('/upload-post/queue/next-slot');
    },
  });
}

// ─── Platform metadata (destinations + account) ───────────────────────

export interface UpNamedRef {
  id?: string;
  name: string;
}

export function useFacebookPagesQuery(enabled?: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: upKeys.facebookPages,
    enabled: computed(() => toValue(enabled ?? true)),
    queryFn: () => {
      const api = useApi();
      return api.get<UpNamedRef[]>('/upload-post/platforms/facebook/pages');
    },
  });
}

export function useLinkedinPagesQuery(enabled?: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: upKeys.linkedinPages,
    enabled: computed(() => toValue(enabled ?? true)),
    queryFn: () => {
      const api = useApi();
      return api.get<UpNamedRef[]>('/upload-post/platforms/linkedin/pages');
    },
  });
}

export function usePinterestBoardsQuery(enabled?: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: upKeys.pinterestBoards,
    enabled: computed(() => toValue(enabled ?? true)),
    queryFn: () => {
      const api = useApi();
      return api.get<UpNamedRef[]>('/upload-post/platforms/pinterest/boards');
    },
  });
}

export interface UpMeResponse {
  plan?: string;
  usage?: { used?: number; limit?: number };
  [key: string]: unknown;
}

export function useMeQuery() {
  return useQuery({
    queryKey: upKeys.me,
    queryFn: () => {
      const api = useApi();
      return api.get<UpMeResponse>('/upload-post/me');
    },
  });
}

export function useConfigureWebhooksMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      webhookUrl: string;
      telegramChatId?: string;
      events?: {
        uploadCompleted?: boolean;
        socialAccountConnected?: boolean;
        socialAccountDisconnected?: boolean;
        socialAccountReauthRequired?: boolean;
      };
    }) => {
      const api = useApi();
      return api.post<unknown>('/upload-post/webhooks/configure', vars);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: upKeys.webhooks }),
  });
}

// ─── Content ideas ────────────────────────────────────────────────────

export interface UpIdea {
  id: string;
  title: string;
  description?: string | null;
  status: 'idea' | 'drafting' | 'ready' | 'scheduled' | 'published';
  priority?: string | null;
  platforms?: string[] | null;
  tags?: string[] | null;
  mediaUrl?: string | null;
  caption?: string | null;
  scheduledAt?: string | null;
  order?: number | null;
}

export function useIdeasQuery() {
  return useQuery({
    queryKey: upKeys.ideas,
    queryFn: () => {
      const api = useApi();
      return api.get<UpIdea[]>('/upload-post/ideas');
    },
  });
}

export function useCreateIdeaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      data: Partial<Omit<UpIdea, 'id' | 'status'>> & { title: string },
    ) => {
      const api = useApi();
      return api.post<UpIdea>('/upload-post/ideas', data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: upKeys.ideas }),
  });
}

export function useUpdateIdeaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; data: Partial<UpIdea> }) => {
      const api = useApi();
      return api.patch<UpIdea>(`/upload-post/ideas/${vars.id}`, vars.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: upKeys.ideas }),
  });
}

export function useUpdateIdeaStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      status: UpIdea['status'];
      order?: number;
    }) => {
      const api = useApi();
      return api.patch<UpIdea>(`/upload-post/ideas/${vars.id}/status`, {
        status: vars.status,
        order: vars.order,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: upKeys.ideas }),
  });
}

export function useDeleteIdeaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const api = useApi();
      return api.delete<unknown>(`/upload-post/ideas/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: upKeys.ideas }),
  });
}