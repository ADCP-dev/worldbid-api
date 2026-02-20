import { fetchWrapper } from '@/helpers/fetch-wrapper';

export const useTranslations = () => {
  const config = useRuntimeConfig();
  const apiPrefix = config.public.apiPrefix || '/api/v1';
  const baseUrl = `${config.public.apiUrl}${apiPrefix}/translations`;

  const getLangs = () => fetchWrapper.get(`${baseUrl}/langs`);
  const createLang = (body: any) => fetchWrapper.post(`${baseUrl}/langs`, body);
  const updateLang = (id: number, body: any) => fetchWrapper.patch(`${baseUrl}/langs/${id}`, body);
  const deleteLang = (id: number) => fetchWrapper.delete(`${baseUrl}/langs/${id}`);

  const getTranslations = (params: any = {}) => {
    // filter undefined
    const cleanParams = Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null && v !== ''));
    const query = new URLSearchParams(cleanParams as any).toString();
    return fetchWrapper.get(`${baseUrl}?${query}`);
  };
  const createTranslation = (body: any) => fetchWrapper.post(baseUrl, body);
  const updateTranslation = (id: number, body: any) => fetchWrapper.patch(`${baseUrl}/${id}`, body);
  const deleteTranslation = (id: number) => fetchWrapper.delete(`${baseUrl}/${id}`);
  const generateJson = () => fetchWrapper.post(`${baseUrl}/generate`);

  return {
    getLangs,
    createLang,
    updateLang,
    deleteLang,
    getTranslations,
    createTranslation,
    updateTranslation,
    deleteTranslation,
    generateJson,
  };
};
