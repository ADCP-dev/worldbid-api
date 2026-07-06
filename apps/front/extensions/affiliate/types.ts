/**
 * Shared TypeScript interfaces for the Affiliate frontend extension.
 * Mirrors backend DTOs and entities in apps/back/src/extensions/affiliate/.
 */

// ─── API fetch helpers ────────────────────────────────────────────────

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface PaginatedResponse<T> {
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
}

// ─── Partners ─────────────────────────────────────────────────────────

export interface Partner {
  id: number;
  clientId?: number | null;
  userId?: number | null;
  name: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  iban?: string | null;
  commissionRate: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePartnerPayload {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  iban?: string;
  commissionRate?: number | null;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdatePartnerPayload {
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  iban?: string;
  commissionRate?: number | null;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

// ─── Referrals ────────────────────────────────────────────────────────

export interface Referral {
  id: number;
  partnerId: number;
  clientId: number;
  originId?: number | null;
  status: string;
  referredAt?: string;
  referredDate?: string;
  clientName?: string;
  companyName?: string;
  partner?: { id: number; name: string } | null;
  client?: { id: number; name?: string } | null;
  origin?: { id: number; label?: string } | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateReferralPayload {
  partnerId: number;
  clientId: number;
  originId?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateReferralPayload {
  partnerId?: number;
  clientId?: number;
  originId?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

// ─── Commissions ──────────────────────────────────────────────────────

export interface Commission {
  id: number;
  referralId: number;
  projectId: number;
  baseAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: string;
  paidAt?: string | null;
  paidDate?: string | null;
  partner?: { id: number; name: string } | null;
  project?: { id: number; name: string } | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCommissionPayload {
  referralId: number;
  projectId: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCommissionPayload {
  referralId?: number;
  projectId?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

// ─── Portal (self-service) ────────────────────────────────────────────

export interface PortalProfile {
  id?: number;
  name: string;
  email?: string;
  phone?: string | null;
  iban?: string | null;
  companyName?: string | null;
  commissionRate?: number;
}

export interface UpdatePortalProfilePayload {
  name?: string;
  phone?: string;
  iban?: string;
}

export interface CreateMyReferralPayload {
  clientName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

// ─── Summaries / Dashboard ────────────────────────────────────────────

export interface CommissionSummary {
  pending?: number;
  approved?: number;
  paidThisMonth?: number;
}

export interface PortalSummary {
  pending?: number;
  approved?: number;
  paidTotal?: number;
}

export interface AffiliateDashboardData {
  activePartners?: number;
  pendingReferrals?: number;
  pendingCommissions?: number;
  paidThisMonth?: number;
  topPartners?: Array<{
    id: number;
    name: string;
    companyName?: string | null;
    revenue?: number;
    commissionsCount?: number;
  }>;
  recentCommissions?: Commission[];
}

// ─── DataTable cell context ───────────────────────────────────────────
// Minimal TanStack-like row context passed to DataTable column `cell`
// renderers. Mirrors the pattern used by other extensions.

export interface DataTableRow<T = Record<string, unknown>> {
  original: T;
  id?: string;
}

export interface CellContext<T = Record<string, unknown>> {
  row: DataTableRow<T>;
}