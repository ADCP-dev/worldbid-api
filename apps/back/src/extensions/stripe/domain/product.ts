export class Product {
  id: string;
  stripeId?: string;
  name: string;
  description?: string;
  active: boolean;
  metadata?: Record<string, unknown>;
}
