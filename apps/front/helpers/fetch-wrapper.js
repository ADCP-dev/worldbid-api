import { useAuthStore } from "#imports";

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
};

export const fetchWrapper = {
  get: request("GET"),
  post: request("POST"),
  put: request("PUT"),
  patch: request("PATCH"),
  delete: request("DELETE"),
};

function request(method) {
  return async (url, body, options = {}) => {
    const requestOptions = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...authHeader(url),
        ...options.headers,
      },
    };

    if (body) {
      requestOptions.body = JSON.stringify(body);
    }

    if (options.credentials) {
      requestOptions.credentials = options.credentials;
    }

    try {
      const response = await fetch(url, requestOptions);
      return await handleResponse(response, url, requestOptions);
    } catch (error) {
      return Promise.reject(error);
    }
  };
}

// helper functions

function authHeader(url) {
  const runtimeConfig = useRuntimeConfig();
  const apiUrl = runtimeConfig.public.apiUrl;
  const authStore = useAuthStore();

  const isApiUrl = url.startsWith(apiUrl);
  const isAuthEndpoint = url.includes('/auth/email/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/email/register');

  if (isApiUrl && !isAuthEndpoint && authStore.token) {
    return { Authorization: `Bearer ${authStore.token}` };
  }

  return {};
}

async function handleResponse(response, originalUrl, originalOptions) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const authStore = useAuthStore();

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && authStore.isAuthenticated) {
      const isAuthEndpoint = originalUrl.includes('/auth/');

      // Don't try to refresh if this is already an auth endpoint
      if (!isAuthEndpoint) {
        if (isRefreshing) {
          // If already refreshing, queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(token => {
            // Retry original request with new token
            const newOptions = {
              ...originalOptions,
              headers: {
                ...originalOptions.headers,
                Authorization: `Bearer ${token}`,
              },
            };
            return fetch(originalUrl, newOptions).then(handleResponse);
          });
        }

        isRefreshing = true;

        try {
          const refreshResult = await authStore.refreshAccessToken();

          if (refreshResult.success) {
            processQueue(null, refreshResult.token);

            // Retry original request with new token
            const newOptions = {
              ...originalOptions,
              headers: {
                ...originalOptions.headers,
                Authorization: `Bearer ${refreshResult.token}`,
              },
            };

            const retryResponse = await fetch(originalUrl, newOptions);
            return handleResponse(retryResponse, originalUrl, newOptions);
          } else {
            processQueue(new Error('Token refresh failed'), null);
            authStore.logout();
          }
        } catch (refreshError) {
          processQueue(refreshError, null);
          authStore.logout();
        } finally {
          isRefreshing = false;
        }
      } else {
        // Auth endpoint failed, logout user
        authStore.logout();
      }
    }

    // Handle other error statuses
    if (response.status === 403 && authStore.isAuthenticated) {
      // Forbidden - user doesn't have permission
      console.warn('Access forbidden:', data?.message || 'Insufficient permissions');
    }

    const error = new Error(data?.message || response.statusText || 'Request failed');
    error.status = response.status;
    error.data = data;
    return Promise.reject(error);
  }

  return data;
}
