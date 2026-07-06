/**
 * Composable for the Affiliate extension.
 * Wraps all API calls to the backend affiliate extension endpoints.
 * Admin endpoints require admin role; portal endpoints are self-scoped (affiliate).
 */

import type {
  AffiliateDashboardData,
  ApiFetchOptions,
  Commission,
  CommissionSummary,
  CreateCommissionPayload,
  CreateMyReferralPayload,
  CreatePartnerPayload,
  CreateReferralPayload,
  PaginatedResponse,
  Partner,
  PortalProfile,
  PortalSummary,
  Referral,
  UpdateCommissionPayload,
  UpdatePartnerPayload,
  UpdatePortalProfilePayload,
  UpdateReferralPayload,
} from '../types';

function useApi() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  const baseUrl = config.public.apiUrl as string;
  const apiPrefix = (config.public.apiPrefix as string) || '/api/v1';

  async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
    const headers: Record<string, string> = { ...options.headers };
    if (authStore.token) {
      headers.Authorization = `Bearer ${authStore.token}`;
    }
    const res = await $fetch<T>(`${baseUrl}${apiPrefix}${path}`, {
      method: options.method,
      query: options.query,
      body: options.body as BodyInit | Record<string, unknown> | null | undefined,
      headers,
    });
    return res as T;
  }

  return { apiFetch };
}

export function useAffiliate() {
  const { apiFetch } = useApi();

  // ─── Partners (Admin) ──────────────────────────────────────────────────

  async function getPartners(
    page = 1,
    search?: string,
  ): Promise<PaginatedResponse<Partner> | Partner[]> {
    const query: Record<string, string | number | undefined> = { page };
    if (search) query.search = search;
    return apiFetch<PaginatedResponse<Partner> | Partner[]>('/affiliate/partners', { query });
  }

  async function getPartner(id: number | string): Promise<Partner> {
    return apiFetch<Partner>(`/affiliate/partners/${id}`);
  }

  async function createPartner(data: CreatePartnerPayload): Promise<Partner> {
    return apiFetch<Partner>('/affiliate/partners', { method: 'POST', body: data });
  }

  async function updatePartner(id: number | string, data: UpdatePartnerPayload): Promise<Partner> {
    return apiFetch<Partner>(`/affiliate/partners/${id}`, { method: 'PATCH', body: data });
  }

  async function deletePartner(id: number | string): Promise<void> {
    return apiFetch<void>(`/affiliate/partners/${id}`, { method: 'DELETE' });
  }

  async function invitePartner(id: number | string): Promise<void> {
    return apiFetch<void>(`/affiliate/partners/${id}/invite`, { method: 'POST' });
  }

  // ─── Referrals (Admin) ─────────────────────────────────────────────────

  async function getReferrals(
    partnerId?: number | string,
    status?: string,
  ): Promise<PaginatedResponse<Referral> | Referral[]> {
    const query: Record<string, string | number | undefined> = {};
    if (partnerId) query.partnerId = partnerId;
    if (status) query.status = status;
    return apiFetch<PaginatedResponse<Referral> | Referral[]>('/affiliate/referrals', { query });
  }

  async function createReferral(data: CreateReferralPayload): Promise<Referral> {
    return apiFetch<Referral>('/affiliate/referrals', { method: 'POST', body: data });
  }

  async function updateReferral(id: number | string, data: UpdateReferralPayload): Promise<Referral> {
    return apiFetch<Referral>(`/affiliate/referrals/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteReferral(id: number | string): Promise<void> {
    return apiFetch<void>(`/affiliate/referrals/${id}`, { method: 'DELETE' });
  }

  // ─── Commissions (Admin) ──────────────────────────────────────────────

  async function getCommissions(
    partnerId?: number | string,
    status?: string,
  ): Promise<PaginatedResponse<Commission> | Commission[]> {
    const query: Record<string, string | number | undefined> = {};
    if (partnerId) query.partnerId = partnerId;
    if (status) query.status = status;
    return apiFetch<PaginatedResponse<Commission> | Commission[]>('/affiliate/commissions', { query });
  }

  async function createCommission(data: CreateCommissionPayload): Promise<Commission> {
    return apiFetch<Commission>('/affiliate/commissions', { method: 'POST', body: data });
  }

  async function updateCommission(id: number | string, data: UpdateCommissionPayload): Promise<Commission> {
    return apiFetch<Commission>(`/affiliate/commissions/${id}`, { method: 'PATCH', body: data });
  }

  async function getCommissionSummary(): Promise<CommissionSummary> {
    return apiFetch<CommissionSummary>('/affiliate/commissions/summary');
  }

  // ─── Dashboard (Admin) ─────────────────────────────────────────────────

  async function getAffiliateDashboard(): Promise<AffiliateDashboardData> {
    return apiFetch<AffiliateDashboardData>('/affiliate/dashboard');
  }

  // ─── Portal (self) ─────────────────────────────────────────────────────

  async function getMyProfile(): Promise<PortalProfile> {
    return apiFetch<PortalProfile>('/affiliate/portal/profile');
  }

  async function updateMyProfile(data: UpdatePortalProfilePayload): Promise<PortalProfile> {
    return apiFetch<PortalProfile>('/affiliate/portal/profile', { method: 'PATCH', body: data });
  }

  async function getMyReferrals(): Promise<PaginatedResponse<Referral> | Referral[]> {
    return apiFetch<PaginatedResponse<Referral> | Referral[]>('/affiliate/portal/referrals');
  }

  async function createMyReferral(data: CreateMyReferralPayload): Promise<Referral> {
    return apiFetch<Referral>('/affiliate/portal/referrals', { method: 'POST', body: data });
  }

  async function getMyReferral(id: number | string): Promise<Referral> {
    return apiFetch<Referral>(`/affiliate/portal/referrals/${id}`);
  }

  async function getMyCommissions(): Promise<PaginatedResponse<Commission> | Commission[]> {
    return apiFetch<PaginatedResponse<Commission> | Commission[]>('/affiliate/portal/commissions');
  }

  async function getMySummary(): Promise<PortalSummary> {
    return apiFetch<PortalSummary>('/affiliate/portal/summary');
  }

  return {
    // Partners
    getPartners,
    getPartner,
    createPartner,
    updatePartner,
    deletePartner,
    invitePartner,
    // Referrals
    getReferrals,
    createReferral,
    updateReferral,
    deleteReferral,
    // Commissions
    getCommissions,
    createCommission,
    updateCommission,
    getCommissionSummary,
    // Dashboard
    getAffiliateDashboard,
    // Portal
    getMyProfile,
    updateMyProfile,
    getMyReferrals,
    createMyReferral,
    getMyReferral,
    getMyCommissions,
    getMySummary,
  };
}