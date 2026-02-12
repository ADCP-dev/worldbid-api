import type { RuntimeConfig } from "nuxt/schema";

export interface Balance {
  totalTokens: number;
  usedTokens: number;
  remainingTokens: number;
  planType: string;
  subscriptionActive: boolean;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
}

export default class StripeService {
  runtimeConfig: RuntimeConfig;
  apiUrl: string;
  constructor() {
    this.runtimeConfig = useRuntimeConfig();
    this.apiUrl = `${this.runtimeConfig.public.apiUrl}${this.runtimeConfig.public.apiPrefix}`;
  }

  async getPlans(): Promise<any> {
    const response = await fetch(`${this.apiUrl}/stripe/plans`, {
      method: "GET",
    });
    return await response.json();
  }

  async getBalance():
    Promise<Balance | { message: string; statusCode: number; }> {
    const response = await fetch(`${this.apiUrl}/tokens/balance`, {
      method: "GET",
      headers: this.getHeaders(),
    });
    return await response.json();
  }

  async getUrlManageSubscription(): Promise<string> {
    const response = await fetch(
      `${this.apiUrl}/stripe/create-customer-portal`,
      {
        method: "POST",
        headers: this.getHeaders(),
      }
    );
    const json = await response.json();
    return json.url;
  }

  private getHeaders() {
    const authStore = useAuthStore();
    if (!authStore.token) {
      navigateTo("/login");
      throw new Error("Authentication required");
    }
    return {
      Authorization: `Bearer ${authStore.token}`,
      accept: "application/json",
      "Content-Type": "application/json",
    };
  }
}
