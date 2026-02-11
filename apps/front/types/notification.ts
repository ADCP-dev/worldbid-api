export interface CalculationData {
  origin: string;
  destination: string;
  total_km_string: string;
  seguridad_social_total: number;
  irpf_percentage: number;
  irpf_total: number;
  total_cliente: number;
  total_artista: number;
  business_tax_name: string;
  business_tax_percentage: number;
}

export interface NotificationForm {
  establishment_name: string
  address: string
  zip_code: string
  municipality_id: number
  artistsData: Array<{
    id: number | null
    name: string
    email?: string
    method: 'bill_customer' | 'net_artist'
    amount: number
    irpf: number
    address: string
    zip_code: string
    business_tax_name?: string
    business_tax_percentage: number
    municipality_id: number
  }>
}
