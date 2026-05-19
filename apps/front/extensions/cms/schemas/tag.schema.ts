import { z } from 'zod'

export const tagSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
})

export type TagFormData = z.infer<typeof tagSchema>
