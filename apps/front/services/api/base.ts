import { useAuthStore } from "~/stores/auth";

type Method =
  | "GET"
  | "HEAD"
  | "PATCH"
  | "POST"
  | "PUT"
  | "DELETE"
  | "CONNECT"
  | "OPTIONS"
  | "TRACE"
  | "get"
  | "head"
  | "patch"
  | "post"
  | "put"
  | "delete"
  | "connect"
  | "options"
  | "trace"
  | undefined;

const baseHeaders = {
  "Content-Type": "application/json",
};

export const useFetchApi = async (
  endpoint: string,
  method: Method = "GET",
  body?: JSON,
  headers?: HeadersInit
) => {
  try {
    const response = $fetch(`${endpoint}`, {
      method,
      body: body?.toString(),
      headers: {
        ...baseHeaders,
        ...headers,
      },
    });

    return response;
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
};

export const useAuthFetchApi = async (
  endpoint: string,
  method: Method = "GET",
  body?: JSON,
  headers?: HeadersInit
) => {
  const authStore = useAuthStore();
  try {
    const response = $fetch(`${endpoint}`, {
      method,
      body: body?.toString(),
      headers: {
        ...baseHeaders,
        Authorization: `Bearer ${authStore.token}`,
        ...headers,
      },
    });

    return response;
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
};
