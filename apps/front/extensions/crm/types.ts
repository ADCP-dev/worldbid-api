/**
 * Shared TypeScript interfaces for the CRM frontend extension.
 * Mirrors backend DTOs and entities in apps/back/src/extensions/crm/.
 */

// ─── API fetch helpers ────────────────────────────────────────────────

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

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

// ─── Status ───────────────────────────────────────────────────────────

export interface Status {
  id: number;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StatusPayload {
  name?: string;
  label?: string;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

// ─── Origin ───────────────────────────────────────────────────────────

export interface Origin {
  id: number;
  name: string;
  label: string;
  type: string;
  isActive: boolean;
  sortOrder: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface OriginPayload {
  name?: string;
  label?: string;
  type?: string;
  isActive?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

// ─── Client ───────────────────────────────────────────────────────────

export interface Client {
  id: number;
  name: string;
  companyName?: string | null;
  nif?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country: string;
  statusId: number;
  status?: Status | null;
  originId?: number | null;
  origin?: Origin | null;
  originDetail?: string | null;
  metadata?: Record<string, unknown>;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientPayload {
  name?: string;
  companyName?: string;
  nif?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  statusId?: number | null;
  originId?: number | null;
  originDetail?: string;
  metadata?: Record<string, unknown> | null;
  isActive?: boolean;
}

// ─── Contact ──────────────────────────────────────────────────────────

export interface Contact {
  id: number;
  clientId: number;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactPayload {
  clientId?: number;
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
  metadata?: Record<string, unknown>;
}

// ─── Interaction ──────────────────────────────────────────────────────

export type InteractionType = 'meeting' | 'call' | 'email' | 'whatsapp' | 'note' | 'other';

export interface Interaction {
  id: number;
  clientId: number;
  contactId?: number | null;
  type: InteractionType | string;
  subject?: string | null;
  body?: string | null;
  interactionDate: string;
  metadata?: Record<string, unknown>;
  client?: { id: number; name?: string } | null;
  contact?: { id: number; name?: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface InteractionPayload {
  clientId?: number;
  contactId?: number;
  type?: InteractionType | string;
  subject?: string;
  body?: string;
  interactionDate?: string;
  metadata?: Record<string, unknown>;
}

// ─── Project ──────────────────────────────────────────────────────────

export type ProjectType = 'pack_1' | 'pack_2' | 'pack_3' | 'pack_4' | 'custom' | string;
export type ProjectStatus = 'quoted' | 'approved' | 'in_progress' | 'delivered' | 'cancelled' | string;
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded' | string;

export interface Project {
  id: number;
  clientId: number;
  name: string;
  type?: ProjectType | null;
  price?: number | null;
  status: ProjectStatus;
  paymentStatus: PaymentStatus;
  startDate?: string | null;
  endDate?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectPayload {
  clientId?: number;
  name?: string;
  type?: ProjectType;
  price?: number | null;
  status?: ProjectStatus;
  paymentStatus?: PaymentStatus;
  startDate?: string;
  endDate?: string;
  metadata?: Record<string, unknown>;
}

// ─── Dashboard ────────────────────────────────────────────────────────

export interface StatusCount {
  statusId: number;
  statusName?: string;
  label?: string;
  color?: string;
  count: number;
}

export interface OriginCount {
  originId: number;
  label?: string;
  count: number;
}

export interface ProjectStatusCount {
  status: string;
  count: number;
}

export interface DashboardData {
  totalClients?: number;
  activeClients?: number;
  clientsByStatus?: StatusCount[];
  clientsByOrigin?: OriginCount[];
  projectsByStatus?: ProjectStatusCount[];
  activeProjects?: number;
  recentInteractions?: Interaction[];
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
// Shapes pushed into the shared app/nav useState by CRM plugins.

export interface DashboardEntry {
  id: string;
  title: string;
  componentName: string;
}

export interface NavMenuItem {
  title: string;
  icon: string;
  link: string;
}

export interface NavMenuGroup {
  heading: string;
  items: NavMenuItem[];
}