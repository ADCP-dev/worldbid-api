/**
 * Shared TypeScript interfaces for the Content Pipeline frontend extension.
 * Mirrors backend DTOs and entities in apps/back/src/extensions/content-pipeline/.
 */

// ─── API fetch helpers ────────────────────────────────────────────────

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ColumnFilter {
  id: string;
  value: string | number | boolean | null | undefined;
}

export interface PaginatedResponse<T> {
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
}

// ─── Project ──────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  slug: string;
  niche?: string;
  description?: string | null;
  keywords?: string[];
  brandVoice?: string | null;
  targetAudience?: string | null;
  language?: string;
  authorPersona?: Record<string, unknown>;
  affiliateConfig?: Record<string, unknown>;
  socialConfig?: Record<string, unknown>;
  cmsConfig?: Record<string, unknown>;
  autoPublish?: { blog: boolean; social: boolean };
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProjectPayload {
  name: string;
  slug: string;
  niche: string;
  description?: string;
  keywords?: string[];
  brandVoice?: string;
  targetAudience?: string;
  language?: string;
  authorPersona?: Record<string, unknown>;
  affiliateConfig?: Record<string, unknown>;
  socialConfig?: Record<string, unknown>;
  cmsConfig?: Record<string, unknown>;
  autoPublish?: { blog: boolean; social: boolean };
  status?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  niche?: string;
  description?: string;
  keywords?: string[];
  brandVoice?: string;
  targetAudience?: string;
  language?: string;
  authorPersona?: Record<string, unknown>;
  affiliateConfig?: Record<string, unknown>;
  socialConfig?: Record<string, unknown>;
  cmsConfig?: Record<string, unknown>;
  autoPublish?: { blog: boolean; social: boolean };
  status?: string;
}

// ─── Idea ─────────────────────────────────────────────────────────────

export interface Idea {
  id: string;
  projectId: string;
  title: string;
  angle?: string | null;
  keywords?: string[];
  targetPlatforms?: string[];
  contentType?: string;
  source?: string;
  researchData?: Record<string, unknown>;
  status?: string;
  priority?: number;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateIdeaPayload {
  title: string;
  angle?: string;
  keywords?: string[];
  targetPlatforms?: string[];
  contentType?: string;
  source?: string;
  researchData?: Record<string, unknown>;
  priority?: number;
}

export interface UpdateIdeaPayload {
  title?: string;
  angle?: string;
  keywords?: string[];
  targetPlatforms?: string[];
  contentType?: string;
  status?: string;
  priority?: number;
  order?: number;
  researchData?: Record<string, unknown>;
}

export interface ResearchIdeasPayload {
  [key: string]: unknown;
}

// ─── Draft ────────────────────────────────────────────────────────────

export interface Draft {
  id: string;
  projectId: string;
  ideaId?: string | null;
  idea?: { title?: string } | null;
  blogContent?: string | null;
  seoMetadata?: Record<string, unknown>;
  socialVariants?: Record<string, unknown>[];
  images?: Record<string, unknown>[];
  affiliateLinks?: Record<string, unknown>[];
  videos?: Record<string, unknown>[];
  carousels?: Record<string, unknown>[];
  generationLog?: Record<string, unknown>;
  status?: string;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
  publishedTo?: Record<string, unknown>;
  publishedAt?: string | null;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GenerateDraftPayload {
  [key: string]: unknown;
}

export interface UpdateDraftPayload {
  blogContent?: string;
  seoMetadata?: Record<string, unknown>;
  socialVariants?: Record<string, unknown>[];
  images?: Record<string, unknown>[];
  affiliateLinks?: Record<string, unknown>[];
  reviewNotes?: string;
}

export interface RejectDraftPayload {
  reason?: string;
}

// ─── Metrics ──────────────────────────────────────────────────────────

export interface DashboardSummary {
  totalSnapshots: number;
  byPlatform: Array<{ platform: string; snapshots: number; totalViews: number }>;
  totals: {
    views: number;
    clicks: number;
    engagement: number;
    affiliateClicks: number;
    affiliateConversions: number;
    revenue: number;
  };
}

/**
 * Shape read by the dashboard widgets/pages.
 *
 * NOTE: the backend `/metrics/dashboard` endpoint currently returns
 * `DashboardSummary` (snapshots + totals). The pages below read a broader,
 * content-funnel-oriented payload (projects, ideas, drafts counts, by-status
 * breakdowns, recent projects). All fields are optional because the live
 * response may not populate every field. Modeled here so the UI is typed
 * without coupling to the exact backend response shape.
 */
export interface DashboardData {
  totalProjects?: number;
  totalIdeas?: number;
  totalDrafts?: number;
  publishedDrafts?: number;
  totalPublished?: number;
  ideasByStatus?: Array<{ status: string; count: number }>;
  draftsByStatus?: Array<{ status: string; count: number }>;
  recentProjects?: Array<{
    id: string;
    name: string;
    niche?: string;
    status?: string;
    createdAt?: string;
  }>;
}

/**
 * Aggregated project-level metrics as read by the project detail page.
 * NOTE: The backend `/projects/:id/metrics` endpoint currently returns a
 * paginated list of metrics snapshots (MetricsListResult), not these
 * aggregates. The fields below model what the page reads; they are all
 * optional because the live response may not populate them.
 */
export interface ProjectMetrics {
  totalIdeas?: number;
  approvedIdeas?: number;
  totalDrafts?: number;
  publishedDrafts?: number;
  ideasByStatus?: Array<{ status: string; count: number }>;
  draftsByStatus?: Array<{ status: string; count: number }>;
  data?: MetricsSnapshot[];
  total?: number;
  page?: number;
  limit?: number;
}

export interface MetricsSnapshot {
  id: string;
  projectId: string;
  draftId?: string | null;
  platform: string;
  snapshotDate: string;
  metrics: Record<string, unknown>;
  createdAt?: string;
}

// ─── DataTable cell context ───────────────────────────────────────────
// Minimal TanStack-like row context passed to DataTable column `cell`
// renderers. Mirrors the CellContext pattern used by other extensions
// (e.g. autonomous-agent/types/entities.ts).

export interface DataTableRow<T = Record<string, unknown>> {
  original: T;
  id?: string;
}

export interface CellContext<T = Record<string, unknown>> {
  row: DataTableRow<T>;
}

// ─── Video Jobs ───────────────────────────────────────────────────────

export interface VideoJobEnqueueResult {
  jobId: string;
  status: string;
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

export interface VideoJobStatus {
  jobId: string;
  state: string; // 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  result?: VideoJobResult;
  failedReason?: string;
}

// ─── Video Templates ──────────────────────────────────────────────────

export type TemplateType =
  | 'before-after'
  | 'product-showcase'
  | 'presentation'
  | 'tutorial'
  | 'case-study'
  | 'faq'
  | 'comparison'
  | 'timeline'
  | 'problem-solution'
  | 'quote-insight'
  | 'custom';

export type SlotType =
  | 'before'
  | 'after'
  | 'front'
  | 'back'
  | 'feature'
  | 'title'
  | 'agenda'
  | 'content'
  | 'summary'
  | 'hook'
  | 'step'
  | 'result'
  | 'problem'
  | 'solution'
  | 'implementation'
  | 'metric'
  | 'testimonial'
  | 'cta'
  | 'question'
  | 'answer'
  | 'feature-a'
  | 'feature-b'
  | 'verdict'
  | 'milestone'
  | 'current-state'
  | 'why-fail'
  | 'approach'
  | 'how-it-works'
  | 'quote'
  | 'context'
  | 'expansion'
  | 'takeaway';

export interface TemplateSlot {
  position: number;
  slotType: SlotType;
  label: string;
  acceptImage?: boolean;
  required?: boolean;
}

export interface VideoTemplate {
  type: TemplateType;
  name: string;
  description: string;
  slots: TemplateSlot[];
  defaultTransitions: string[];
  defaultSlideDurationSec: number;
  appendCtaVideo: boolean;
  ctaVideoUrl?: string;
  format: 'portrait' | 'vertical';
}

export interface SlotFill {
  imageUrl?: string;
  slide?: Record<string, unknown>;
}

export interface GenerateTemplatePayload {
  template: TemplateType;
  format?: 'portrait' | 'vertical';
  transitions?: string[];
  ctaVideoUrl?: string;
  slots: Record<number, SlotFill>;
}

// ─── CTA Videos ───────────────────────────────────────────────────────

export interface CtaVideo {
  id: string;
  name: string;
  url: string;
  format?: string;
  durationSec?: number | null;
  isActive: boolean;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCtaVideoPayload {
  name: string;
  url: string;
  format?: string;
  durationSec?: number;
  isActive?: boolean;
  description?: string;
}

export interface UpdateCtaVideoPayload {
  name?: string;
  url?: string;
  format?: string;
  durationSec?: number;
  isActive?: boolean;
  description?: string;
}