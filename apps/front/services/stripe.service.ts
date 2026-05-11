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
      headers: this.getHeaders(),
    });
    return await response.json();
  }

  async getBalance(): Promise<
    Balance | { message: string; statusCode: number }
  > {
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
      },
    );
    const json = await response.json();
    return json.url;
  }

  async createCheckoutSession(planId: string): Promise<{ url: string }> {
    const response = await fetch(`${this.apiUrl}/stripe/checkout`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ planId }),
    });
    return await response.json();
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await fetch(`${this.apiUrl}/stripe/subscriptions/${subscriptionId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
  }

  async resumeSubscription(subscriptionId: string): Promise<void> {
    await fetch(`${this.apiUrl}/stripe/subscriptions/${subscriptionId}/resume`, {
      method: "PATCH",
      headers: this.getHeaders(),
    });
  }

  async getInvoices(): Promise<any[]> {
    const response = await fetch(`${this.apiUrl}/stripe/invoices`, {
      method: "GET",
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch invoices");
    return await response.json();
  }

  async downloadInvoice(invoiceId: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/stripe/invoices/${invoiceId}/pdf`, {
      method: "GET",
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error("Failed to download invoice");
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factura-${invoiceId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  async getCustomerPortal(): Promise<{ url: string }> {
    const response = await fetch(`${this.apiUrl}/stripe/portal`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    return await response.json();
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
