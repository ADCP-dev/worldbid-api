/**
 * useErrors — Error tracker composable.
 *
 * Migrated from fetchWrapper to useApi(). All HTTP goes through the
 * centralized transport. The legacy imperative API (functions that
 * resolve with data) is preserved for backward compatibility.
 */
export const useErrors = () => {
  const api = useApi()

  const fetchErrors = async () => {
    return await api.get('/system/errors')
  }

  const reportError = async (error: {
    message: string
    source?: string
    stack?: string
    metadata?: Record<string, unknown>
  }) => {
    await api.post('/system/errors', error)
  }

  const clearErrors = async () => {
    return await api.delete('/system/errors')
  }

  const deleteError = async (id: string) => {
    return await api.delete(`/system/errors/${id}`)
  }

  const resolveError = async (id: string) => {
    return await api.patch(`/system/errors/${id}/resolve`)
  }

  const clearResolvedErrors = async () => {
    return await api.delete('/system/errors/resolved')
  }

  const testBackendError = async () => {
    await api.get('/system/test/error-500')
  }

  return {
    fetchErrors,
    reportError,
    clearErrors,
    deleteError,
    resolveError,
    clearResolvedErrors,
    testBackendError,
  }
}
