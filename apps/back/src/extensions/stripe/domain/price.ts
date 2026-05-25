export class Price {
  id: string;
  stripeId?: string;
  productId: string;
  currency: string;
  unitAmount: number;
  type: 'one_time' | 'recurring';
  interval?: 'month' | 'year';
  active: boolean;
}
