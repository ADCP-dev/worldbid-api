import { fetchWrapper } from "@/helpers/fetch-wrapper";

export const useErrors = () => {
  const config = useRuntimeConfig();
  const baseUrl = `${config.public.apiUrl}${config.public.apiPrefix}`;

  const fetchErrors = async () => {
    const data = await fetchWrapper.get(`${baseUrl}/system/errors`);
    return data;
  };

  const reportError = async (error: {
    message: string;
    source?: string;
    stack?: string;
    metadata?: Record<string, unknown>;
  }) => {
    await fetchWrapper.post(`${baseUrl}/system/errors`, error);
  };

  const clearErrors = async () => {
    const data = await fetchWrapper.delete(`${baseUrl}/system/errors`);
    return data;
  };

  const deleteError = async (id: string) => {
    const data = await fetchWrapper.delete(`${baseUrl}/system/errors/${id}`);
    return data;
  };

  const resolveError = async (id: string) => {
    const data = await fetchWrapper.patch(
      `${baseUrl}/system/errors/${id}/resolve`,
    );
    return data;
  };

  const clearResolvedErrors = async () => {
    const data = await fetchWrapper.delete(`${baseUrl}/system/errors/resolved`);
    return data;
  };

  const testBackendError = async () => {
    await fetchWrapper.get(`${baseUrl}/system/test/error-500`);
  };

  return {
    fetchErrors,
    reportError,
    clearErrors,
    deleteError,
    resolveError,
    clearResolvedErrors,
    testBackendError,
  };
};
