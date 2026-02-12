import { fetchWrapper } from '@/helpers/fetch-wrapper'

export interface UsageSummary {
  last24h: {
    totalTokens: number
    totalInputTokens: number
    totalOutputTokens: number
    totalCost: number
  }
  last30d: {
    totalTokens: number
    totalInputTokens: number
    totalOutputTokens: number
    totalCost: number
  }
  lifetime: {
    totalTokens: number
    totalInputTokens: number
    totalOutputTokens: number
    totalCost: number
  }
}

export interface ModelUsage {
  modelUsed: string
  totalTokens: number
  totalCost: number
}

export default class TokenUsageService {
  private baseUrl: string

  constructor() {
    const config = useRuntimeConfig()
    this.baseUrl = `${config.public.apiUrl}${config.public.apiPrefix}`
  }

  async getSummary(): Promise<UsageSummary> {
    return await fetchWrapper.get(`${this.baseUrl}/token-usage/summary`)
  }

  async getUsageByModel(from?: string, to?: string): Promise<ModelUsage[]> {
    const params = new URLSearchParams()
    if (from) params.append('from', from)
    if (to) params.append('to', to)
    
    return await fetchWrapper.get(`${this.baseUrl}/token-usage/by-model?${params.toString()}`)
  }

  async getHistory(chatbotId?: string): Promise<any[]> {
    const params = new URLSearchParams()
    if (chatbotId) params.append('chatbotId', chatbotId)
    
    return await fetchWrapper.get(`${this.baseUrl}/token-usage/history?${params.toString()}`)
  }
}
