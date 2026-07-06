/**
 * Shared TypeScript interfaces for the Stripe frontend extension.
 * Mirrors backend DTOs/entities in apps/back/src/extensions/stripe/.
 */

// ─── API fetch helpers ────────────────────────────────────────────────

export interface ColumnFilter {
  id: string;
  value: string | number | boolean | null | undefined;
}

export interface PaginatedResponse<T> {
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
}

// ─── Product ──────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  stripeProductId?: string | null;
  active: boolean;
  images?: string[] | null;
  metadata?: Record<string, unknown> | null;
  prices?: Price[] | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductPayload {
  name?: string;
  description?: string | null;
  stripeProductId?: string | null;
  active?: boolean;
  images?: string[] | null;
  metadata?: Record<string, unknown> | null;
}

// ─── Price ────────────────────────────────────────────────────────────

export type PriceInterval = 'day' | 'week' | 'month' | 'year' | string;

export interface Price {
  id: string;
  productId: string;
  product?: Product | null;
  stripePriceId?: string | null;
  unitAmount: number; // cents
  currency: string;
  interval?: PriceInterval | null;
  intervalCount?: number | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PricePayload {
  productId?: string;
  stripePriceId?: string | null;
  unitAmount?: number;
  currency?: string;
  interval?: PriceInterval | null;
  intervalCount?: number | null;
  active?: boolean;
}

// ─── Plan ─────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  description?: string | null;
  priceId?: string | null;
  price?: Price | null;
  features?: string[] | null;
  isDefault?: boolean;
  maxUsers?: number | null;
  maxStorage?: number | null;
  active: boolean;
  subscribersCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanPayload {
  name?: string;
  description?: string | null;
  priceId?: string | null;
  features?: string[] | null;
  isDefault?: boolean;
  maxUsers?: number | null;
  maxStorage?: number | null;
  active?: boolean;
}

// ─── Subscription ─────────────────────────────────────────────────────

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'
  | string;

export interface Subscription {
  id: string;
  stripeSubscriptionId?: string | null;
  customerEmail?: string | null;
  customerId?: string | null;
  planId?: string | null;
  plan?: Plan | null;
  status: SubscriptionStatus;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  canceledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubscriptionPayload {
  planId?: string;
  customerId?: string;
  status?: SubscriptionStatus;
}

// ─── Dashboard ────────────────────────────────────────────────────────

export interface StripeDashboardData {
  mrr: number;
  activeSubscriptionsCount: number;
  totalProducts: number;
  totalPlans: number;
  recentProducts: Product[];
  recentSubscriptions: Subscription[];
}

// ─── DataTable cell context ───────────────────────────────────────────
// Minimal TanStack-like row context passed to DataTable column `cell`
// renderers. Mirrors the pattern used by other extensions.

export interface DataTableRow<T = Record<string, unknown>> {
  original: T;
  id?: string;
}

export interface CellContext<T = Record<string, unknown>> {
  row: DataTableRow<T>;
}

// ─── App shell integration (plugins) ──────────────────────────────────

export interface NavMenuItem {
  title: string;
  icon: string;
  link: string;
}

export interface NavMenuGroup {
  heading: string;
  items: NavMenuItem[];
}