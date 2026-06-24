/**
 * useTranslations — Translations module composable.
 *
 * Migrated from fetchWrapper to useApi(). The legacy imperative API
 * is preserved for backward compatibility with all call sites.
 */
export const useTranslations = () => {
  const api = useApi()

  const getLangs = () => api.get('/translations/langs')
  const createLang = (body: any) => api.post('/translations/langs', body)
  const updateLang = (id: number, body: any) =>
    api.patch(`/translations/langs/${id}`, body)
  const deleteLang = (id: number) => api.delete(`/translations/langs/${id}`)

  const getTranslations = async (params: any = {}) => {
    // filter undefined
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v != null && v !== ''),
    )
    const { data } = await api.get<{ data: any }>('/translations', { query: cleanParams })
    return data
  }

  const getExactTranslation = async (
    app: string,
    section: string,
    key: string,
  ) => {
    return await api.get('/translations/exact', {
      query: { app, section, key },
    })
  }

  const getExactTranslationByDotPath = async (
    app: string,
    dotPath: string,
  ) => {
    return await api.get('/translations/exact-by-path', {
      query: { app, dotPath },
    })
  }

  const createTranslation = (body: any) => api.post('/translations', body)
  const updateTranslation = (id: number, body: any) =>
    api.patch(`/translations/${id}`, body)
  const deleteTranslation = (id: number) =>
    api.delete(`/translations/${id}`)
  const generateJson = () => api.post('/translations/generate')
  const bulkTranslate = (app: string) =>
    api.post(`/translations/bulk-translate`, { app })
  const syncTranslations = () => api.post('/translations/sync')

  return {
    getLangs,
    createLang,
    updateLang,
    deleteLang,
    getTranslations,
    getExactTranslation,
    getExactTranslationByDotPath,
    createTranslation,
    updateTranslation,
    deleteTranslation,
    generateJson,
    bulkTranslate,
    syncTranslations,
  }
}
