import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'

/**
 * useSubscription — TanStack Query composable for Stripe subscription state.
 *
 * All HTTP goes through useApi() so auth token + 401-refresh is centralized.
 */
export function useSubscriptionQuery(userId: string | number = 'me') {
  const api = useApi()
  return useQuery({
    queryKey: ['subscription', userId],
    queryFn: () => api.get(`/stripe/subscriptions/${userId}`),
  })
}

export function usePlansQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['stripe', 'plans'],
    queryFn: () => api.get('/stripe/plans'),
  })
}

export function useCheckoutMutation() {
  const api = useApi()
  return useMutation({
    mutationFn: (planId: string) =>
      api.post<{ url: string }>('/stripe/checkout', { planId }),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url
      }
    },
  })
}

export function useCancelMutation() {
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

export function useResumeMutation() {
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
