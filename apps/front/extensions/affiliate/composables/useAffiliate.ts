import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import type {
  AffiliateDashboardData,
  Commission,
  CommissionSummary,
  CreateCommissionPayload,
  CreateMyReferralPayload,
  CreatePartnerFromClientPayload,
  CreatePartnerFromClientResult,
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

/**
 * Affiliate extension — TanStack Query hooks.
 *
 * Admin endpoints under /affiliate/*; self-service portal under
 * /affiliate/portal/* (scoped server-side by the authenticated user).
 *
 * All HTTP goes through useApi() (centralized auth + 401-refresh).
 */

export const affiliateKeys = {
  partners: ['affiliate', 'partners'] as const,
  partner: (id: number | string) => ['affiliate', 'partners', id] as const,
  referrals: ['affiliate', 'referrals'] as const,
  commissions: ['affiliate', 'commissions'] as const,
  commissionSummary: ['affiliate', 'commissions', 'summary'] as const,
  dashboard: ['affiliate', 'dashboard'] as const,
  portal: {
    profile: ['affiliate', 'portal', 'profile'] as const,
    referrals: ['affiliate', 'portal', 'referrals'] as const,
    commissions: ['affiliate', 'portal', 'commissions'] as const,
    summary: ['affiliate', 'portal', 'summary'] as const,
  },
};

// ─── Partners (Admin) ─────────────────────────────────────────────────

export function usePartnersQuery(page?: MaybeRefOrGetter<number>, search?: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: computed(() => [...affiliateKeys.partners, unref(page) ?? 1, unref(search) ?? '']),
    queryFn: () => {
      const api = useApi();
      return api.get<PaginatedResponse<Partner> | Partner[]>('/affiliate/partners', {
        query: { page: toValue(page), search: toValue(search) },
      });
    },
  });
}

export function usePartnerQuery(id: MaybeRefOrGetter<number | string | undefined>) {
  return useQuery({
    queryKey: computed(() => affiliateKeys.partner(unref(id) ?? 0)),
    enabled: computed(() => unref(id) !== undefined),
    queryFn: () => {
      const api = useApi();
      const key = toValue(id) as string | number;
      return api.get<Partner>(`/affiliate/partners/${key}`);
    },
  });
}

export function useCreatePartnerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePartnerPayload) => {
      const api = useApi();
      return api.post<Partner>('/affiliate/partners', data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: affiliateKeys.partners }),
  });
}

export function useUpdatePartnerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: UpdatePartnerPayload }) => {
      const api = useApi();
      return api.patch<Partner>(`/affiliate/partners/${id}`, data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: affiliateKeys.partners });
      qc.invalidateQueries({ queryKey: affiliateKeys.partner(vars.id) });
    },
  });
}

export function useDeletePartnerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => {
      const api = useApi();
      return api.delete<void>(`/affiliate/partners/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: affiliateKeys.partners }),
  });
}

export function useInvitePartnerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => {
      const api = useApi();
      return api.post<Partner>(`/affiliate/partners/${id}/invite`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: affiliateKeys.partners }),
  });
}

export function useCreatePartnerFromClientMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: number; data: CreatePartnerFromClientPayload }) => {
      const api = useApi();
      return api.post<CreatePartnerFromClientResult>(
        `/affiliate/partners/from-client/${clientId}`,
        data,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: affiliateKeys.partners });
      qc.invalidateQueries({ queryKey: affiliateKeys.dashboard });
    },
  });
}

// ─── Referrals (Admin) ────────────────────────────────────────────────

export function useReferralsQuery(partnerId?: MaybeRefOrGetter<number | string | undefined>, status?: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: computed(() => [...affiliateKeys.referrals, unref(partnerId) ?? '', unref(status) ?? '']),
    queryFn: () => {
      const api = useApi();
      return api.get<PaginatedResponse<Referral> | Referral[]>('/affiliate/referrals', {
        query: { partnerId: toValue(partnerId), status: toValue(status) },
      });
    },
  });
}

export function useCreateReferralMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReferralPayload) => {
      const api = useApi();
      return api.post<Referral>('/affiliate/referrals', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: affiliateKeys.referrals });
      qc.invalidateQueries({ queryKey: affiliateKeys.dashboard });
    },
  });
}

export function useUpdateReferralMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: UpdateReferralPayload }) => {
      const api = useApi();
      return api.patch<Referral>(`/affiliate/referrals/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: affiliateKeys.referrals });
      qc.invalidateQueries({ queryKey: affiliateKeys.dashboard });
    },
  });
}

export function useDeleteReferralMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => {
      const api = useApi();
      return api.delete<void>(`/affiliate/referrals/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: affiliateKeys.referrals }),
  });
}

// ─── Commissions (Admin) ──────────────────────────────────────────────

export function useCommissionsQuery(partnerId?: MaybeRefOrGetter<number | string | undefined>, status?: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: computed(() => [...affiliateKeys.commissions, unref(partnerId) ?? '', unref(status) ?? '']),
    queryFn: () => {
      const api = useApi();
      return api.get<PaginatedResponse<Commission> | Commission[]>('/affiliate/commissions', {
        query: { partnerId: toValue(partnerId), status: toValue(status) },
      });
    },
  });
}

export function useCommissionSummaryQuery() {
  return useQuery({
    queryKey: affiliateKeys.commissionSummary,
    queryFn: () => {
      const api = useApi();
      return api.get<CommissionSummary>('/affiliate/commissions/summary');
    },
  });
}

export function useCreateCommissionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCommissionPayload) => {
      const api = useApi();
      return api.post<Commission>('/affiliate/commissions', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: affiliateKeys.commissions });
      qc.invalidateQueries({ queryKey: affiliateKeys.dashboard });
      qc.invalidateQueries({ queryKey: affiliateKeys.commissionSummary });
    },
  });
}

export function useUpdateCommissionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: UpdateCommissionPayload }) => {
      const api = useApi();
      return api.patch<Commission>(`/affiliate/commissions/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: affiliateKeys.commissions });
      qc.invalidateQueries({ queryKey: affiliateKeys.commissionSummary });
      qc.invalidateQueries({ queryKey: affiliateKeys.dashboard });
    },
  });
}

// ─── Dashboard (Admin) ────────────────────────────────────────────────

export function useAffiliateDashboardQuery() {
  return useQuery({
    queryKey: affiliateKeys.dashboard,
    queryFn: () => {
      const api = useApi();
      return api.get<AffiliateDashboardData>('/affiliate/dashboard');
    },
  });
}

// ─── Portal (self) ────────────────────────────────────────────────────

export function useMyProfileQuery() {
  return useQuery({
    queryKey: affiliateKeys.portal.profile,
    queryFn: () => {
      const api = useApi();
      return api.get<PortalProfile>('/affiliate/portal/me');
    },
  });
}

export function useUpdateMyProfileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePortalProfilePayload) => {
      const api = useApi();
      return api.patch<PortalProfile>('/affiliate/portal/me', data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: affiliateKeys.portal.profile }),
  });
}

export function useMyReferralsQuery() {
  return useQuery({
    queryKey: affiliateKeys.portal.referrals,
    queryFn: () => {
      const api = useApi();
      return api.get<PaginatedResponse<Referral> | Referral[]>('/affiliate/portal/referrals');
    },
  });
}

export function useCreateMyReferralMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMyReferralPayload) => {
      const api = useApi();
      return api.post<Referral>('/affiliate/portal/referrals', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: affiliateKeys.portal.referrals });
      qc.invalidateQueries({ queryKey: affiliateKeys.portal.summary });
    },
  });
}

export function useMyCommissionsQuery() {
  return useQuery({
    queryKey: affiliateKeys.portal.commissions,
    queryFn: () => {
      const api = useApi();
      return api.get<Commission[]>('/affiliate/portal/commissions');
    },
  });
}

export function useMySummaryQuery() {
  return useQuery({
    queryKey: affiliateKeys.portal.summary,
    queryFn: () => {
      const api = useApi();
      return api.get<PortalSummary>('/affiliate/portal/summary');
    },
  });
}

/** Convenience: unwrap paginated-or-array API responses. */
export function unwrapList<T>(res: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(res) ? res : (res.data ?? []);
}