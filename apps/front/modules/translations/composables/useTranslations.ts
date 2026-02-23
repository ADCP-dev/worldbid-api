import { fetchWrapper } from '@/helpers/fetch-wrapper';

export const useTranslations = () => {
  const config = useRuntimeConfig();
  const apiPrefix = config.public.apiPrefix || '/api/v1';
  const baseUrl = `${config.public.apiUrl}${apiPrefix}/translations`;

  const getLangs = () => fetchWrapper.get(`${baseUrl}/langs`);
  const createLang = (body: any) => fetchWrapper.post(`${baseUrl}/langs`, body);
  const updateLang = (id: number, body: any) => fetchWrapper.patch(`${baseUrl}/langs/${id}`, body);
  const deleteLang = (id: number) => fetchWrapper.delete(`${baseUrl}/langs/${id}`);

  const getTranslations = async (params: any = {}) => {
    // filter undefined
    const cleanParams = Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null && v !== ''));
    const query = new URLSearchParams(cleanParams as any).toString();
    const { data } = await fetchWrapper.get(`${baseUrl}?${query}`);
    return data;
  };

  const getExactTranslation = async (app: string, section: string, key: string) => {
    return await fetchWrapper.get(`${baseUrl}/exact?app=${app}&section=${section}&key=${key}`);
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
    getExactTranslation,
    createTranslation,
    updateTranslation,
    deleteTranslation,
    generateJson,
  };
};
