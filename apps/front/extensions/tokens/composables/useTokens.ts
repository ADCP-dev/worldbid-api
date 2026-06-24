import { useQuery } from '@tanstack/vue-query'

/**
 * Tokens extension — composables for token-usage statistics.
 *
 * All HTTP through useApi(); all cache through TanStack Query.
 */

export interface UsageSummary {
  last24h: { totalTokens: number; totalInputTokens: number; totalOutputTokens: number; totalCost: number }
  last30d: { totalTokens: number; totalInputTokens: number; totalOutputTokens: number; totalCost: number }
  lifetime: { totalTokens: number; totalInputTokens: number; totalOutputTokens: number; totalCost: number }
}

export interface ModelUsage {
  modelUsed: string
  totalTokens: number
  totalCost: number
}

export interface TokenUsageHistoryItem {
  id: string | number
  chatbotId: string
  modelUsed: string
  totalTokens: number
  createdAt: string
}

export function useTokenUsageSummaryQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['token-usage', 'summary'],
    queryFn: () => api.get<UsageSummary>('/token-usage/summary'),
  })
}

export function useTokenUsageByModelQuery(params: { from?: string; to?: string } = {}) {
  const api = useApi()
  return useQuery({
    queryKey: ['token-usage', 'by-model', params],
    queryFn: () => api.get<ModelUsage[]>('/token-usage/by-model', { query: params }),
  })
}

export function useTokenUsageHistoryQuery(params: { chatbotId?: string } = {}) {
  const api = useApi()
  return useQuery({
    queryKey: ['token-usage', 'history', params],
    queryFn: () => api.get<TokenUsageHistoryItem[]>('/token-usage/history', { query: params }),
  })
}
