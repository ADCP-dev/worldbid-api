export type SchemaType = 'WebSite' | 'Article' | 'Product' | 'Organization' | 'LocalBusiness' | 'BreadcrumbList'

export interface BaseSeoOptions {
  title?: string
  description?: string
  image?: string
  url?: string
  schemaType?: SchemaType
}

export interface ArticleSchemaData {
  headline: string
  datePublished: string
  dateModified?: string
  authorName?: string
  publisherName?: string
  publisherLogo?: string
}

export interface ProductSchemaData {
  name: string
  description?: string
  image?: string
  sku?: string
  brand?: string
  offers?: {
    price: string | number
    priceCurrency: string
    availability?: 'https://schema.org/InStock' | 'https://schema.org/OutOfStock' | 'https://schema.org/PreOrder'
  }
}

export interface OrganizationSchemaData {
  name: string
  url?: string
  logo?: string
  sameAs?: string[]
}

export interface LocalBusinessSchemaData extends OrganizationSchemaData {
  address?: {
    streetAddress?: string
    addressLocality?: string
    addressRegion?: string
    postalCode?: string
    addressCountry?: string
  }
  telephone?: string
  geo?: {
    latitude: number
    longitude: number
  }
}

export interface BreadcrumbListSchemaData {
  itemListElement: {
    position: number
    name: string
    item: string
  }[]
}

// Union type for schema data
export type SchemaData =
  | ArticleSchemaData
  | ProductSchemaData
  | OrganizationSchemaData
  | LocalBusinessSchemaData
  | BreadcrumbListSchemaData

export interface SeoOptions extends BaseSeoOptions {
  schemaData?: SchemaData
}

export function useSeo(options: SeoOptions = {}) {
  const runtimeConfig = useRuntimeConfig()
  const appName = runtimeConfig.public.appName as string

  const title = options.title || appName
  const description = options.description || `Welcome to ${appName}`
  const image = options.image || '/og-image.png'
  const url = options.url || ''

  // set meta tags
  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogImage: image,
    ogType: options.schemaType === 'Article' ? 'article' : 'website',
    ogSiteName: appName,
    ogUrl: url,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
  })

  // Helper to generate schema
  const generateSchema = () => {
    const baseSchema: Record<string, any> = {
      '@context': 'https://schema.org',
    }

    switch (options.schemaType) {
      case 'Article': {
        const data = options.schemaData as ArticleSchemaData
        return {
          ...baseSchema,
          '@type': 'Article',
          headline: data?.headline || title,
          image: [image],
          datePublished: data?.datePublished,
          dateModified: data?.dateModified || data?.datePublished,
          author: {
            '@type': 'Person',
            name: data?.authorName || appName,
          },
          publisher: {
            '@type': 'Organization',
            name: data?.publisherName || appName,
            logo: {
              '@type': 'ImageObject',
              url: data?.publisherLogo || '/logo.png',
            },
          },
        }
      }
      case 'Product': {
        const data = options.schemaData as ProductSchemaData
        return {
          ...baseSchema,
          '@type': 'Product',
          name: data?.name || title,
          description: data?.description || description,
          image: [data?.image || image],
          sku: data?.sku,
          brand: {
            '@type': 'Brand',
            name: data?.brand || appName,
          },
          offers: data?.offers
            ? {
                '@type': 'Offer',
                price: data.offers.price,
                priceCurrency: data.offers.priceCurrency,
                availability: data.offers.availability || 'https://schema.org/InStock',
              }
            : undefined,
        }
      }
      case 'Organization': {
        const data = options.schemaData as OrganizationSchemaData
        return {
          ...baseSchema,
          '@type': 'Organization',
          name: data?.name || appName,
          url: data?.url || url,
          logo: data?.logo || '/logo.png',
          sameAs: data?.sameAs || [],
        }
      }
      case 'LocalBusiness': {
        const data = options.schemaData as LocalBusinessSchemaData
        return {
          ...baseSchema,
          '@type': 'LocalBusiness',
          name: data?.name || appName,
          image: [image],
          '@id': url,
          url: url,
          telephone: data?.telephone,
          address: data?.address
            ? {
                '@type': 'PostalAddress',
                ...data.address,
              }
            : undefined,
          geo: data?.geo
            ? {
                '@type': 'GeoCoordinates',
                ...data.geo,
              }
            : undefined,
          sameAs: data?.sameAs || [],
        }
      }
      case 'BreadcrumbList': {
        const data = options.schemaData as BreadcrumbListSchemaData
        return {
          ...baseSchema,
          '@type': 'BreadcrumbList',
          itemListElement: data?.itemListElement?.map((item) => ({
            '@type': 'ListItem',
            position: item.position,
            name: item.name,
            item: item.item,
          })) || [],
        }
      }
      case 'WebSite':
      default:
        return {
          ...baseSchema,
          '@type': 'WebSite',
          name: appName,
          description,
          url: url,
        }
    }
  }

  const schema = generateSchema()

  if (schema) {
    useHead({
      script: [
        {
          type: 'application/ld+json',
          children: JSON.stringify(schema),
        },
      ],
    })
  }
}
