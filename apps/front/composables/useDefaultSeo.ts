export function useDefaultSeo(options: {
  title?: string
  description?: string
  image?: string
  url?: string
} = {}) {
  const runtimeConfig = useRuntimeConfig()
  const appName = runtimeConfig.public.appName as string

  const title = options.title || appName
  const description = options.description || 'Welcome to ' + appName
  const image = options.image || '/og-image.png'
  const url = options.url || ''

  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogImage: image,
    ogType: 'website',
    ogSiteName: appName,
    ogUrl: url,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
  })

  useHead({
    script: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: appName,
          description: description,
          url: url,
        }),
      },
    ],
  })
}
