/**
 * useApi — Centralized HTTP client for Foundation Frontend.
 *
 * Provides base URL, auth token injection, and 401-refresh-once-then-retry
 * semantics. All API calls in the app should go through this composable
 * (directly or via TanStack Query composables like useUsersQuery).
 *
 * Usage:
 *   const api = useApi()
 *   const data = await api.get<User[]>('/users')
 *
 * With TanStack Query:
 *   useQuery({
 *     queryKey: ['users'],
 *     queryFn: () => useApi().get<User[]>('/users'),
 *   })
 *
 * Auth contract:
 *   - Adds `Authorization: Bearer <token>` if user is authenticated.
 *   - On 401 (non-auth endpoint), refreshes token once and retries.
 *   - On refresh failure with 401, logs out and rejects. On network/server
 *     failure during refresh, keeps the session and surfaces the error.
 */
import { useAuthStore } from '#imports';

export type ApiOptions = Omit<RequestInit, 'body' | 'method'> & {
  /** Query string params appended to path as `?key=value`. */
  query?: Record<string, string | number | boolean | undefined | null>;
};

export type ApiError = Error & {
  status: number;
  data: unknown;
};

export function useApi() {
  const config = useRuntimeConfig();
  const auth = useAuthStore();
  const baseUrl = `${config.public.apiUrl}${config.public.apiPrefix}`;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: ApiOptions = {},
  ): Promise<T> {
    const { query, headers: extraHeaders, ...rest } = options;

    let url = `${baseUrl}${path}`;
    if (query) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) qs.append(k, String(v));
      }
      const s = qs.toString();
      if (s) url += (path.includes('?') ? '&' : '?') + s;
    }

    // "Auth endpoint" = endpoints that authenticate (login, register, refresh,
    // confirm, forgot, reset). They do NOT need the access-token Authorization
    // header and a 401 from them means invalid credentials (not a stale token
    // to refresh). /auth/me and /auth/logout DO require the JWT — exclude them.
    // /auth/refresh is special: it authenticates with the REFRESH token sent
    // as `Authorization: Bearer <refreshToken>` (backend contract), so callers
    // must pass that header explicitly via options.headers.
    const isAuthEndpoint =
      path.startsWith('/auth/') &&
      !path.startsWith('/auth/me') &&
      !path.startsWith('/auth/logout');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((extraHeaders as Record<string, string>) ?? {}),
    };
    const hasExplicitAuthorization = Object.keys(headers).some(
      (key) => key.toLowerCase() === 'authorization',
    );
    if (auth.token && !isAuthEndpoint && !hasExplicitAuthorization) {
      headers.Authorization = `Bearer ${auth.token}`;
    }

    const init: RequestInit = {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...rest,
    };

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      throw Object.assign(new Error('Network error'), { cause: err });
    }

    if (res.status === 401 && auth.token && !isAuthEndpoint) {
      // Single-flight is owned by the store: concurrent 401s share one
      // in-flight refresh call and one rotation on the backend.
      const refreshed = await auth.refreshAccessToken();
      if (refreshed?.success === true) {
        const retryInit: RequestInit = {
          ...init,
          headers: {
            ...(init.headers as Record<string, string>),
            Authorization: `Bearer ${auth.token}`,
          },
        };
        res = await fetch(url, retryInit);
      } else if (refreshed?.retriable) {
        // Network/server failure during refresh: keep tokens intact and
        // surface the error — the next navigation can retry the refresh.
        const err = new Error(
          refreshed.error instanceof Error
            ? refreshed.error.message
            : 'Token refresh failed',
        ) as ApiError;
        err.status = 0;
        err.data = null;
        throw err;
      } else {
        // Refresh endpoint answered 401 (or no refresh token): session dead.
        auth.logout();
      }
    }

    const text = await res.text();
    const data: unknown = text ? safeJsonParse(text) : null;

    if (!res.ok) {
      const message =
        (data && typeof data === 'object' && 'message' in data
          ? String((data as { message: unknown }).message)
          : res.statusText) || 'Request failed';
      const err = new Error(message) as ApiError;
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data as T;
  }

  return {
    get: <T>(path: string, options?: ApiOptions) =>
      request<T>('GET', path, undefined, options),
    post: <T>(path: string, body?: unknown, options?: ApiOptions) =>
      request<T>('POST', path, body, options),
    put: <T>(path: string, body?: unknown, options?: ApiOptions) =>
      request<T>('PUT', path, body, options),
    patch: <T>(path: string, body?: unknown, options?: ApiOptions) =>
      request<T>('PATCH', path, body, options),
    delete: <T>(path: string, options?: ApiOptions) =>
      request<T>('DELETE', path, undefined, options),
  };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
