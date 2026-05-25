export class Plan {
  id: string;
  name: string;
  description?: string;
  priceId: string;
  maxUsers?: number;
  maxStorage?: number;
  features?: string[];
  isDefault: boolean;
  active: boolean;
}
