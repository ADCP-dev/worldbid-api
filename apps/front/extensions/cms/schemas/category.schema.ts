import { z } from 'zod'

export const categorySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  slug: z.string().min(1, 'El slug es obligatorio').regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  description: z.string().optional(),
  parentId: z.string().nullable().optional(),
})

export type CategoryFormData = z.infer<typeof categorySchema>
