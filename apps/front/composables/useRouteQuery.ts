/**
 * Composable for reactive route query parameter management.
 *
 * Preserves existing query params when updating, properly handles
 * array values (no loss via `as string`), and supports excluding
 * keys from preservation (e.g., resetting `page` on filter change).
 */
export function useRouteQuery(defaultExcludeKeys: string[] = ['page']) {
  const route = useRoute()
  const router = useRouter()

  /** Reactive read of current query params, filtering out empty/null values. */
  const params = computed(() => {
    const result: Record<string, string | string[]> = {}
    for (const [key, val] of Object.entries(route.query)) {
      if (val !== undefined && val !== '' && val !== null) {
        result[key] = val as string | string[]
      }
    }
    return result
  })

  /**
   * Replace current route query, preserving existing params minus excluded keys.
   *
   * @param updates - Key-value pairs to set. `undefined` or `''` or empty array removes the key.
   * @param extraExcludeKeys - Additional keys to exclude from preservation (beyond defaultExcludeKeys).
   */
  function updateQuery(
    updates: Record<string, string | string[] | undefined>,
    extraExcludeKeys: string[] = [],
  ) {
    const allExcludeKeys = [...defaultExcludeKeys, ...extraExcludeKeys]
    const newQuery: Record<string, string | string[]> = {}

    for (const [key, val] of Object.entries(route.query)) {
      if (!allExcludeKeys.includes(key) && val !== undefined && val !== '' && val !== null) {
        newQuery[key] = val as string | string[]
      }
    }

    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
        delete newQuery[key]
      } else {
        newQuery[key] = val
      }
    }

    router.replace({ path: route.path, query: newQuery })
  }

  /**
   * Build a URL query string from current params with optional overrides.
   * Properly handles array values via repeated keys.
   *
   * @param overrides - Key-value pairs to set/override. `undefined` omits the key.
   */
  function buildQueryString(overrides: Record<string, string | number | undefined> = {}): string {
    const searchParams = new URLSearchParams()

    for (const [key, val] of Object.entries(route.query)) {
      if (val === undefined || val === '' || val === null) continue
      if (defaultExcludeKeys.includes(key) && !(key in overrides)) continue
      if (Array.isArray(val)) {
        for (const v of val) searchParams.append(key, v as string)
      } else {
        searchParams.append(key, val as string)
      }
    }

    for (const [key, val] of Object.entries(overrides)) {
      if (val === undefined || val === '') {
        searchParams.delete(key)
      } else {
        searchParams.set(key, String(val))
      }
    }

    return searchParams.toString()
  }

  return { params, updateQuery, buildQueryString }
}
