import type { AuthenticatedUser, FieldPermissionSpec } from '../spec-engine/spec.types';

export interface RealtimeEvent {
  event: 'insert' | 'update' | 'delete';
  resource: string;
  id: number | string;
  data?: Record<string, unknown>;
  changes?: Record<string, unknown>;
}

export interface RealtimeClient {
  data: { user: AuthenticatedUser | null };
  join: (channel: string) => void;
  leave: (channel: string) => void;
  emit: (event: string, data: unknown) => void;
  disconnect: () => void;
  handshake: { query: Record<string, unknown> };
  id: string;
}

export interface RealtimeServer {
  sockets: {
    adapter: {
      rooms: Map<string, Set<RealtimeClient>>;
    };
  };
  to: (channel: string) => { emit: (event: string, data: unknown) => void };
}

export type FieldPermissionMap = Record<string, FieldPermissionSpec>;