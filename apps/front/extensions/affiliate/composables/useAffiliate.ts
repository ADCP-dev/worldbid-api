/**
 * Composable for the Affiliate extension.
 * Wraps all API calls to the backend affiliate extension endpoints.
 * Admin endpoints require admin role; portal endpoints are self-scoped (affiliate).
 */

const API_PREFIX = '/api/v1';

function useApi() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  const baseUrl = config.public.apiUrl as string;

  async function apiFetch<T>(path: string, options: any = {}): Promise<T> {
    const token = authStore.token;
    const res = await $fetch<T>(`${baseUrl}${API_PREFIX}${path}`, {
      ...options,
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        ...options.headers,
      },
    });
    return res as T;
  }

  return { apiFetch };
}

export function useAffiliate() {
  const { apiFetch } = useApi();

  // ─── Partners (Admin) ──────────────────────────────────────────────────

  async function getPartners(page = 1, search?: string) {
    const query: Record<string, any> = { page };
    if (search) query.search = search;
    return apiFetch('/affiliate/partners', { query });
  }

  async function getPartner(id: number | string) {
    return apiFetch(`/affiliate/partners/${id}`);
  }

  async function createPartner(data: Record<string, any>) {
    return apiFetch('/affiliate/partners', { method: 'POST', body: data });
  }

  async function updatePartner(id: number | string, data: Record<string, any>) {
    return apiFetch(`/affiliate/partners/${id}`, { method: 'PATCH', body: data });
  }

  async function deletePartner(id: number | string) {
    return apiFetch(`/affiliate/partners/${id}`, { method: 'DELETE' });
  }

  async function invitePartner(id: number | string) {
    return apiFetch(`/affiliate/partners/${id}/invite`, { method: 'POST' });
  }

  // ─── Referrals (Admin) ─────────────────────────────────────────────────

  async function getReferrals(partnerId?: number | string, status?: string) {
    const query: Record<string, any> = {};
    if (partnerId) query.partnerId = partnerId;
    if (status) query.status = status;
    return apiFetch('/affiliate/referrals', { query });
  }

  async function createReferral(data: Record<string, any>) {
    return apiFetch('/affiliate/referrals', { method: 'POST', body: data });
  }

  async function updateReferral(id: number | string, data: Record<string, any>) {
    return apiFetch(`/affiliate/referrals/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteReferral(id: number | string) {
    return apiFetch(`/affiliate/referrals/${id}`, { method: 'DELETE' });
  }

  // ─── Commissions (Admin) ──────────────────────────────────────────────

  async function getCommissions(partnerId?: number | string, status?: string) {
    const query: Record<string, any> = {};
    if (partnerId) query.partnerId = partnerId;
    if (status) query.status = status;
    return apiFetch('/affiliate/commissions', { query });
  }

  async function createCommission(data: Record<string, any>) {
    return apiFetch('/affiliate/commissions', { method: 'POST', body: data });
  }

  async function updateCommission(id: number | string, data: Record<string, any>) {
    return apiFetch(`/affiliate/commissions/${id}`, { method: 'PATCH', body: data });
  }

  async function getCommissionSummary() {
    return apiFetch('/affiliate/commissions/summary');
  }

  // ─── Dashboard (Admin) ─────────────────────────────────────────────────

  async function getAffiliateDashboard() {
    return apiFetch('/affiliate/dashboard');
  }

  // ─── Portal (self) ─────────────────────────────────────────────────────

  async function getMyProfile() {
    return apiFetch('/affiliate/portal/profile');
  }

  async function updateMyProfile(data: Record<string, any>) {
    return apiFetch('/affiliate/portal/profile', { method: 'PATCH', body: data });
  }

  async function getMyReferrals() {
    return apiFetch('/affiliate/portal/referrals');
  }

  async function createMyReferral(data: Record<string, any>) {
    return apiFetch('/affiliate/portal/referrals', { method: 'POST', body: data });
  }

  async function getMyReferral(id: number | string) {
    return apiFetch(`/affiliate/portal/referrals/${id}`);
  }

  async function getMyCommissions() {
    return apiFetch('/affiliate/portal/commissions');
  }

  async function getMySummary() {
    return apiFetch('/affiliate/portal/summary');
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