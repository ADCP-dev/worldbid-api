import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'

/**
 * Stripe extension — composables for Stripe operations.
 *
 * Pattern: one file per extension. Each function is a TanStack Query hook
 * (useQuery or useMutation) that delegates to `useApi()` for transport.
 *
 * All HTTP through useApi() so auth token + 401-refresh is centralized.
 */

export function usePlansQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['stripe', 'plans'],
    queryFn: () => api.get('/stripe/plans'),
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
