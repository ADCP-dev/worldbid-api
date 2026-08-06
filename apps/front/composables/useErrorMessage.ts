/**
 * errorMessage — Extract a human-readable error message from any error.
 *
 * Auto-imported by Nuxt (lives in composables/). Replaces the 30 duplicated
 * `function errorMessage(err)` blocks that existed across extensions.
 *
 * Handles:
 * - FetchError from `$fetch` / `ofetch` (Nuxt): has `data.errors` (422 validation)
 *   or `data.message` (generic API error)
 * - ApiError from `useApi`: has `status` + `data` with `errors` or `message`
 * - Native Error: uses `.message`
 * - String: returns as-is
 *
 * Usage:
 *   try { await api.createClient(payload) }
 *   catch (err) { toast.error('Error', { description: errorMessage(err) }) }
 *
 * For 422 validation errors, joins all field errors into a readable string:
 *   "name: name must be a string, email: email must be valid"
 */
export function errorMessage(err: unknown): string {
  if (!err) return 'Unknown error'

  // FetchError from ofetch/$fetch — has .data with the response body
  const fetchErr = err as {
    data?: { errors?: Record<string, string>; message?: string }
    message?: string
    status?: number
  }
  if (fetchErr?.data) {
    // 422 validation errors: { errors: { name: "name must be a string", email: "..." } }
    if (fetchErr.data.errors && typeof fetchErr.data.errors === 'object') {
      const fieldErrors = Object.entries(fetchErr.data.errors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join(', ')
      return fieldErrors || 'Validation error'
    }
    // Generic API error: { message: "Something went wrong" }
    if (fetchErr.data.message) {
      return String(fetchErr.data.message)
    }
  }

  // ApiError from useApi — has .status + .data
  const apiErr = err as {
    status?: number
    data?: { errors?: Record<string, string>; message?: string }
  }
  if (apiErr?.data) {
    if (apiErr.data.errors && typeof apiErr.data.errors === 'object') {
      const fieldErrors = Object.entries(apiErr.data.errors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join(', ')
      return fieldErrors || 'Validation error'
    }
    if (apiErr.data.message) {
      return String(apiErr.data.message)
    }
  }

  // Native Error
  if (err instanceof Error) {
    return err.message
  }

  // String or other
  return String(err)
}