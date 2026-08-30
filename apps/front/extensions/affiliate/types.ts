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
  code?: string | null;
  name: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  iban?: string | null;
  commissionRate: number;
  isActive: boolean;
  referralsCount?: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePartnerPayload {
  name: string;
  companyName?: string;
  email: string;
  phone?: string;
  iban?: string;
  commissionRate?: number | null;
  isActive?: boolean;
}

export interface UpdatePartnerPayload {
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  iban?: string;
  commissionRate?: number | null;
  isActive?: boolean;
}

export interface CreatePartnerFromClientPayload {
  commissionRate: number;
  invite?: boolean;
}

export interface CreatePartnerFromClientResult {
  partner: Partner;
  created: boolean;
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
  client?: { id: number; name?: string; companyName?: string | null } | null;
  origin?: { id: number; label?: string } | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface NewClientPayload {
  name: string;
  email: string;
  companyName?: string;
  phone?: string;
}

export interface CreateReferralPayload {
  partnerId: number;
  clientId?: number;
  newClient?: NewClientPayload;
  originId?: number;
  status?: string;
}

export interface UpdateReferralPayload {
  status?: string;
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
  referral?: { id: number; partnerId: number } | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCommissionPayload {
  referralId: number;
  projectId: number;
}

export interface UpdateCommissionPayload {
  status?: string;
}

export interface CommissionSummary {
  pendingTotal?: number;
  approvedTotal?: number;
  paidTotal?: number;
  paidThisMonth?: number;
}

// ─── Portal (self-service) ────────────────────────────────────────────

export interface PortalProfile {
  id?: number;
  code?: string | null;
  name: string;
  email?: string;
  phone?: string | null;
  iban?: string | null;
  companyName?: string | null;
  commissionRate?: number;
}

export interface UpdatePortalProfilePayload {
  phone?: string;
  iban?: string;
  companyName?: string;
}

export interface CreateMyReferralPayload {
  clientName: string;
  companyName?: string;
  email: string;
  phone?: string;
  notes?: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────

export interface PortalSummary {
  pendingTotal?: number;
  approvedTotal?: number;
  paidTotal?: number;
  paidThisMonth?: number;
}

export interface AffiliateDashboardData {
  activePartners?: number;
  totalReferrals?: number;
  pendingReferrals?: number;
  convertedReferrals?: number;
  pendingCommissions?: number;
  approvedCommissions?: number;
  paidThisMonth?: number;
  totalPaid?: number;
  topPartners?: Array<{
    id: number;
    name: string;
    companyName?: string | null;
    revenue?: number;
    commissionsCount?: number;
  }>;
  monthlySeries?: Array<{ month: string; paid: number; pending: number }>;
  recentCommissions?: Commission[];
}