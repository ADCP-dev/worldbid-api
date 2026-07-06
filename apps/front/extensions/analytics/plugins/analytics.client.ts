export default defineNuxtPlugin(() => {
  if (import.meta.server) return

  const config = useRuntimeConfig()
  const route = useRoute()
  const api = `${config.public.apiUrl}${config.public.apiPrefix}/analytics/tracking`

  // Anonymous fingerprint
  const fp = () => {
    try {
      return btoa(`${navigator.userAgent}-${screen.width}x${screen.height}`).substring(0, 32)
    } catch {
      return 'unknown'
    }
  }

  // Extract source/campaign from query params
  const trackingParams = computed(() => {
    const q = route.query
    return {
      source: (q.utm_source || q.source || q.via || '') as string,
      campaign: (q.utm_campaign || q.campaign || q.via || '') as string,
      trackingSlug: (q.via || '') as string,
    }
  })

  // Routes to exclude from tracking (admin, auth, errors)
  const EXCLUDED_PATTERNS = [
    '/app',
    '/admin',
    '/login',
    '/login-basic',
    '/register',
    '/forgot-password',
    '/password-change',
    '/401',
    '/403',
    '/404',
    '/500',
    '/503',
  ]

  function isExcluded(path: string): boolean {
    // Strip query params and hash for matching
    const parts = path.split('?')
    const cleanPath = parts[0]?.split('#')[0] ?? path
    return EXCLUDED_PATTERNS.some(p =>
      cleanPath === p || cleanPath.startsWith(p + '/')
    )
  }

  // Track pageview (v1 + source/campaign)
  watch(() => route.fullPath, async (path) => {
    if (isExcluded(path)) return
    try {
      await $fetch(`${api}/pageview`, {
        method: 'POST',
        body: {
          fingerprint: fp(),
          path,
          referrer: document.referrer || '',
          source: trackingParams.value.source,
          campaign: trackingParams.value.campaign,
          trackingSlug: trackingParams.value.trackingSlug,
        },
      })
    } catch {
      // Silent fail
    }
  }, { immediate: true })

  // Global API
  window.foundation = {
    track(type: string, data?: Record<string, any>) {
      $fetch(`${api}/event`, {
        method: 'POST',
        body: {
          type,
          fingerprint: fp(),
          path: route.fullPath,
          data,
          source: trackingParams.value.source,
          campaign: trackingParams.value.campaign,
          trackingSlug: trackingParams.value.trackingSlug,
        },
      }).catch(() => {})
    },
  }

  // Declarative events: data-foundation-event
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest?.('[data-foundation-event]') as HTMLElement | null
    if (!el) return

    const eventType = el.getAttribute('data-foundation-event')!
    const eventData: Record<string, string> = {}

    for (const attr of el.getAttributeNames()) {
      const match = attr.match(/^data-foundation-event-(.+)$/)
      if (match && match[1]) {
        eventData[match[1]] = el.getAttribute(attr) || ''
      }
    }

    window.foundation?.track(eventType, eventData)
  })
})
