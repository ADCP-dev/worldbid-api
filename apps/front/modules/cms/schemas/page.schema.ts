import { z } from 'zod'

export const translationItemSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio'),
  slug: z.string().min(1, 'El slug es obligatorio').regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  description: z.string().optional(),
  content: z.string().min(1, 'El contenido es obligatorio'),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
})

export type TranslationItem = z.infer<typeof translationItemSchema>

export const pageSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  slug: z.string().min(1, 'El slug es obligatorio').regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  section: z.enum(['landing', 'blog', 'documentation', 'store']),
  isPublished: z.boolean().optional(),
  translations: z.record(z.string(), translationItemSchema).optional(),
})

export type PageFormData = z.infer<typeof pageSchema>
