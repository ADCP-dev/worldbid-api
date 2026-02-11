import { z } from 'zod'

export const artistSchema = z.object({
  id: z.number().nullable(),
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email inválido').optional(),
  method: z.enum(['bill_customer', 'net_artist']),
  amount: z.number().min(0, 'El importe debe ser mayor a 0'),
  irpf: z.number().min(0, 'El IRPF debe ser mayor o igual a 0'),
  address: z.string().min(1, 'La dirección es requerida'),
  zip_code: z.string().min(5, 'El código postal debe tener 5 dígitos'),
  business_tax_name: z.string().optional(),
  business_tax_percentage: z.number().min(0).default(0),
  municipality_id: z.number().min(1, 'El municipio es requerido')
})

export const notificationSimulationFormSchema = z.object({
  establishment_name: z.string().min(1, 'El nombre del establecimiento es requerido'),
  address: z.string().min(1, 'La dirección es requerida'),
  zip_code: z.string().min(5, 'El código postal debe tener 5 dígitos'),
  municipality_id: z.number().min(1, 'El municipio es requerido'),
  artistsData: z.array(artistSchema).min(1, 'Debe haber al menos un artista'),
  group_name: z.string().optional(),
})

export const notificationGuestFormSchema = z.object({
  delegation: z.string(),
  establishment_name: z.string().min(1, 'El nombre del establecimiento es requerido'),
  address: z.string().min(1, 'La dirección es requerida'),
  zip_code: z.string().min(5, 'El código postal debe tener 5 dígitos'),
  municipality_id: z.number().min(1, 'El municipio es requerido'),
  artistsData: z.array(artistSchema).min(1, 'Debe haber al menos un artista'),
  group_name: z.string().optional(),
})

export const notificationFormSchema = z.object({
  establishment_name: z.string().min(1, 'El nombre del establecimiento es requerido'),
  address: z.string().min(1, 'La dirección es requerida'),
  zip_code: z.string().min(5, 'El código postal debe tener 5 dígitos'),
  municipality_id: z.number().min(1, 'El municipio es requerido'),
  artistsData: z.array(artistSchema).min(1, 'Debe haber al menos un artista'),
  group_name: z.string().optional(),
  date: z.date(),
  time: z.string(),
  frequency: z.enum(['one_time', 'weekly', 'biweekly']),
  end_date_frequency: z.date().optional(),
  concept: z.string(),
  emission_type: z.enum(['same_day', 'next_day']),
  nif: z.string(),
  client: z.string(),
  // Admin fields
  comision_min: z.number().optional(),
  comision_percentage: z.number().optional(),
})

export type NotificationForm = z.infer<typeof notificationFormSchema>
export type NotificationSimulationForm = z.infer<typeof notificationSimulationFormSchema>
export type NotificationGuestForm = z.infer<typeof notificationGuestFormSchema>
export type ArtistData = z.infer<typeof artistSchema>
