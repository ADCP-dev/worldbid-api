/**
 * Unit tests — auth refresh flow (C1–C4 bugfix).
 *
 * Covers:
 *  - Refresh token sent via Authorization header, not body (C1).
 *  - Single-flight: concurrent callers share one refresh request (C4).
 *  - 401 from /auth/refresh → logout; network/5xx → retriable, session kept (C3).
 *  - useApi 401 handling: retry only on successful refresh (C2);
 *    retriable refresh failure surfaces error without logout.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useAuthStore } from '../../modules/base/auth/stores/auth.store';

// useApi() is called inside store actions; mock its module so we control
// the returned api object per test.
const apiMock = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../../../composables/useApi', () => ({
  useApi: () => apiMock,
}));

// Auto-imported globals used by the store (Nuxt runtime).
const navigateToMock = vi.fn();
(globalThis as Record<string, unknown>).navigateTo = navigateToMock;
(globalThis as Record<string, unknown>).useApi = () => apiMock;
(globalThis as Record<string, unknown>).useRuntimeConfig = () => ({
  public: { apiUrl: 'http://localhost:3000', apiPrefix: '/api/v1' },
});

const AUTH_PAYLOAD = {
  token: 'access-token',
  refreshToken: 'refresh-token',
  tokenExpires: Date.now() + 15 * 60 * 1000,
  user: null,
};

describe('useAuthStore.refreshAccessToken', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiMock.post.mockReset();
    apiMock.get.mockReset();
    navigateToMock.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send refresh token in Authorization header, not body', async () => {
    const store = useAuthStore();
    store.setAuthData({ ...AUTH_PAYLOAD, user: null });

    apiMock.post.mockResolvedValueOnce({
      token: 'new-access',
      refreshToken: 'new-refresh',
      tokenExpires: Date.now() + 15 * 60 * 1000,
    });
    apiMock.get.mockResolvedValueOnce({
      id: 1,
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.c',
      role: { name: 'admin' },
    });

    const result = await store.refreshAccessToken();

    expect(result.success).toBe(true);
    expect(apiMock.post).toHaveBeenCalledTimes(1);
    const [path, body, options] = apiMock.post.mock.calls[0];
    expect(path).toBe('/auth/refresh');
    expect(body).toEqual({});
    expect(options?.headers?.Authorization).toBe('Bearer refresh-token');
  });

  it('should trigger only one refresh for concurrent calls', async () => {
    const store = useAuthStore();
    store.setAuthData({ ...AUTH_PAYLOAD, user: null });

    let resolvePost: (v: unknown) => void;
    apiMock.post.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );

    const p1 = store.refreshAccessToken();
    const p2 = store.refreshAccessToken();
    const p3 = store.refreshAccessToken();

    resolvePost!({
      token: 'new-access',
      refreshToken: 'new-refresh',
      tokenExpires: Date.now() + 15 * 60 * 1000,
    });

    const results = await Promise.all([p1, p2, p3]);

    // Exactly one HTTP call and all callers share the same result.
    expect(apiMock.post).toHaveBeenCalledTimes(1);
    expect(apiMock.get).toHaveBeenCalledTimes(1);
    for (const r of results) {
      expect(r.success).toBe(true);
    }
    // In-flight slot cleared after completion.
    expect(store.refreshInFlight).toBeNull();
  });

  it('should not logout on network error during refresh', async () => {
    const store = useAuthStore();
    store.setAuthData({ ...AUTH_PAYLOAD, user: null });

    apiMock.post.mockRejectedValueOnce(new Error('fetch failed'));

    const result = await store.refreshAccessToken();

    expect(result.success).toBe(false);
    expect(result.retriable).toBe(true);
    // Tokens intact, no redirect triggered.
    expect(store.refreshToken).toBe('refresh-token');
    expect(store.token).toBe('access-token');
    expect(navigateToMock).not.toHaveBeenCalled();
    expect(store.refreshInFlight).toBeNull();
  });

  it('should not logout on 5xx during refresh', async () => {
    const store = useAuthStore();
    store.setAuthData({ ...AUTH_PAYLOAD, user: null });

    apiMock.post.mockRejectedValueOnce(
      Object.assign(new Error('Request failed'), { status: 503 }),
    );

    const result = await store.refreshAccessToken();

    expect(result.success).toBe(false);
    expect(result.retriable).toBe(true);
    expect(store.refreshToken).toBe('refresh-token');
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it('should logout when refresh endpoint returns 401', async () => {
    const store = useAuthStore();
    store.setAuthData({ ...AUTH_PAYLOAD, user: null });

    apiMock.post.mockRejectedValueOnce(
      Object.assign(new Error('Request failed'), { status: 401 }),
    );

    const result = await store.refreshAccessToken();

    expect(result.success).toBe(false);
    expect(result.retriable).toBeUndefined();
    // logout() clears state and redirects.
    expect(store.token).toBeNull();
    expect(store.refreshToken).toBeNull();
    expect(navigateToMock).toHaveBeenCalledWith('/login');
    expect(store.refreshInFlight).toBeNull();
  });

  it('should return failure without request when no refresh token exists', async () => {
    const store = useAuthStore();

    const result = await store.refreshAccessToken();

    expect(result.success).toBe(false);
    expect(apiMock.post).not.toHaveBeenCalled();
  });
});

describe('useApi 401 handling', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    navigateToMock.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupFetchMock(
    impl: (url: string, init?: RequestInit) => Promise<Response>,
  ) {
    const fetchMock = vi.fn(
      impl as (input: RequestInfo, init?: RequestInit) => Promise<Response>,
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('should retry original request only when refresh succeeded', async () => {
    setActivePinia(createPinia());
    setupFetchMock()
      .mockImplementationOnce(() =>
        Promise.resolve(new Response(null, { status: 401 })),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      );

    const store = useAuthStore();
    store.setAuthData({ ...AUTH_PAYLOAD, user: null });
    // Single-flight refresh shared by the interceptor: mimics the real store
    // success path, which stores the rotated tokens before resolving.
    store.refreshInFlight = Promise.resolve({
      success: true,
      token: 'new-access',
    }).then((r) => {
      store.token = 'new-access';
      return r;
    });

    const { useApi } = await import('../../../../composables/useApi');
    const api = (useApi as () => typeof apiMock)();
    const data = await api.get<{ ok: boolean }>('/users');

    expect(data).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    // Retry must carry the fresh access token.
    const retryInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[1][1];
    expect(retryInit.headers.Authorization).toBe('Bearer new-access');
  });

  it('should log out when refresh ends with 401', async () => {
    setActivePinia(createPinia());
    setupFetchMock().mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 401 })),
    );

    const store = useAuthStore();
    store.setAuthData({ ...AUTH_PAYLOAD, user: null });
    store.refreshInFlight = Promise.resolve({
      success: false,
      error: 'Request failed',
    });

    const { useApi } = await import('../../../../composables/useApi');
    const api = (useApi as () => typeof apiMock)();

    await expect(api.get('/users')).rejects.toThrow('Request failed');
    // Refresh failed with 401 → no retry, logout once, session cleared.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(store.token).toBeNull();
    expect(navigateToMock).toHaveBeenCalledWith('/login');
  });

  it('should surface error without logout when refresh is retriable', async () => {
    setActivePinia(createPinia());
    setupFetchMock().mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 401 })),
    );

    const store = useAuthStore();
    store.setAuthData({ ...AUTH_PAYLOAD, user: null });
    store.refreshInFlight = Promise.resolve({
      success: false,
      retriable: true,
      error: new Error('Network error'),
    });

    const { useApi } = await import('../../../../composables/useApi');
    const api = (useApi as () => typeof apiMock)();

    await expect(api.get('/users')).rejects.toThrow('Network error');
    // Only the original request happened — no retry with a dead token,
    // no logout, tokens untouched.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(store.token).toBe('access-token');
    expect(store.refreshToken).toBe('refresh-token');
    expect(navigateToMock).not.toHaveBeenCalled();
  });
});
