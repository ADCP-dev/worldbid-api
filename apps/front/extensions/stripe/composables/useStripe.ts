import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import type {
  PaginatedResponse,
  Plan,
  Price,
  Product,
  ProductPayload,
  PricePayload,
  PlanPayload,
  Subscription,
  SubscriptionPayload,
  SubscriptionStatus,
  StripeDashboardData,
} from '../types';

/**
 * Stripe extension — composables for Stripe operations.
 *
 * Pattern: one file per extension. Each function is a TanStack Query hook
 * (useQuery or useMutation) that delegates to `useApi()` for transport.
 *
 * All HTTP through useApi() so auth token + 401-refresh is centralized.
 */

// ─── Query keys ───────────────────────────────────────────────────────

export const stripeKeys = {
  products: ['stripe', 'products'] as const,
  product: (id: string) => ['stripe', 'products', id] as const,
  prices: ['stripe', 'prices'] as const,
  plans: ['stripe', 'plans'] as const,
  subscriptions: ['stripe', 'subscriptions'] as const,
  dashboard: ['stripe', 'dashboard'] as const,
};

// ─── Legacy plan/checkout hooks (kept for existing pages) ─────────────

export function usePlansQuery() {
  const api = useApi()
  return useQuery({
    queryKey: stripeKeys.plans,
    queryFn: () => api.get<Plan[]>('/stripe/plans'),
  })
}

export function useBalanceQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['tokens', 'balance'],
    queryFn: () => api.get('/tokens/balance'),
  })
}

export function useCheckoutMutation() {
  const api = useApi()
  return useMutation({
    mutationFn: (planId: string) =>
      api.post<{ url: string }>('/stripe/checkout', { planId }),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url
    },
  })
}

export function useCustomerPortalMutation() {
  const api = useApi()
  return useMutation({
    mutationFn: () => api.post<{ url: string }>('/stripe/create-customer-portal'),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url
    },
  })
}

export function useCancelSubscriptionMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (subscriptionId: string) =>
      api.delete(`/stripe/subscriptions/${subscriptionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription'] })
    },
  })
}

export function useResumeSubscriptionMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (subscriptionId: string) =>
      api.patch(`/stripe/subscriptions/${subscriptionId}/resume`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription'] })
    },
  })
}

export function useInvoicesQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['stripe', 'invoices'],
    queryFn: () => api.get('/stripe/invoices'),
    staleTime: 60_000,
  })
}

export function useStripeTestPaymentMutation() {
  const api = useApi()
  return useMutation({
    mutationFn: () => api.post('/stripe/test/payment'),
  })
}

export function useStripeTestSubscriptionMutation() {
  const api = useApi()
  return useMutation({
    mutationFn: () => api.post('/stripe/test/subscription'),
  })
}

export function useStripeTestWebhookSimulateMutation() {
  const api = useApi()
  return useMutation({
    mutationFn: () => api.post('/stripe/test/webhook/simulate'),
  })
}

export function useStripeTestPaymentsQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['stripe', 'test', 'payments'],
    queryFn: () => api.get('/stripe/test/payments'),
  })
}

export function useStripeTestMethodsQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['stripe', 'test', 'methods'],
    queryFn: () => api.get('/stripe/test/methods'),
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────

export function useStripeDashboardQuery() {
  const api = useApi()
  return useQuery({
    queryKey: stripeKeys.dashboard,
    queryFn: () => api.get<StripeDashboardData>('/stripe/dashboard'),
  })
}

// ─── Products ─────────────────────────────────────────────────────────

export function useProductsQuery() {
  const api = useApi()
  return useQuery({
    queryKey: stripeKeys.products,
    queryFn: () => api.get<PaginatedResponse<Product> | Product[]>('/stripe/products'),
  })
}

export function useProductQuery(id: string) {
  const api = useApi()
  return useQuery({
    queryKey: stripeKeys.product(id),
    queryFn: () => api.get<Product>(`/stripe/products/${id}`),
    enabled: !!id,
  })
}

export function useCreateProductMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ProductPayload) =>
      api.post<Product>('/stripe/products', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stripeKeys.products })
      qc.invalidateQueries({ queryKey: stripeKeys.dashboard })
    },
  })
}

export function useUpdateProductMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProductPayload }) =>
      api.patch<Product>(`/stripe/products/${id}`, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: stripeKeys.products })
      qc.invalidateQueries({ queryKey: stripeKeys.product(data.id) })
      qc.invalidateQueries({ queryKey: stripeKeys.dashboard })
    },
  })
}

export function useDeleteProductMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/stripe/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stripeKeys.products })
      qc.invalidateQueries({ queryKey: stripeKeys.dashboard })
    },
  })
}

// ─── Prices ───────────────────────────────────────────────────────────

export function usePricesQuery() {
  const api = useApi()
  return useQuery({
    queryKey: stripeKeys.prices,
    queryFn: () => api.get<PaginatedResponse<Price> | Price[]>('/stripe/prices'),
  })
}

export function useCreatePriceMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: PricePayload) =>
      api.post<Price>('/stripe/prices', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stripeKeys.prices })
      qc.invalidateQueries({ queryKey: stripeKeys.products })
    },
  })
}

export function useUpdatePriceMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PricePayload }) =>
      api.patch<Price>(`/stripe/prices/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stripeKeys.prices })
      qc.invalidateQueries({ queryKey: stripeKeys.products })
    },
  })
}

export function useDeletePriceMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/stripe/prices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stripeKeys.prices })
      qc.invalidateQueries({ queryKey: stripeKeys.products })
    },
  })
}

// ─── Plans ────────────────────────────────────────────────────────────

export function useCreatePlanMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: PlanPayload) =>
      api.post<Plan>('/stripe/plans', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stripeKeys.plans })
      qc.invalidateQueries({ queryKey: stripeKeys.dashboard })
    },
  })
}

export function useUpdatePlanMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PlanPayload }) =>
      api.patch<Plan>(`/stripe/plans/${id}`, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: stripeKeys.plans })
      qc.invalidateQueries({ queryKey: stripeKeys.dashboard })
    },
  })
}

export function useDeletePlanMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/stripe/plans/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stripeKeys.plans })
      qc.invalidateQueries({ queryKey: stripeKeys.dashboard })
    },
  })
}

// ─── Subscriptions ────────────────────────────────────────────────────

export function useSubscriptionsQuery(status?: SubscriptionStatus) {
  const api = useApi()
  return useQuery({
    queryKey: ['stripe', 'subscriptions', status ?? 'all'],
    queryFn: () => {
      const query = status ? { status } : undefined
      return api.get<PaginatedResponse<Subscription> | Subscription[]>(
        '/stripe/subscriptions',
        { query },
      )
    },
  })
}

export function useSubscriptionQuery(id: string) {
  const api = useApi()
  return useQuery({
    queryKey: ['stripe', 'subscriptions', 'detail', id],
    queryFn: () => api.get<Subscription>(`/stripe/subscriptions/${id}`),
    enabled: !!id,
  })
}

export function useCancelAdminSubscriptionMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<Subscription>(`/stripe/subscriptions/${id}`, { status: 'canceled' as SubscriptionStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stripe', 'subscriptions'] })
      qc.invalidateQueries({ queryKey: stripeKeys.dashboard })
    },
  })
}