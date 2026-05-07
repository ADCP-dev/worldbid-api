export class UsageRecord {
  id: string;
  subscriptionId: string;
  stripeId?: string;
  quantity: number;
  timestamp: Date;
  action: 'set' | 'increment';
}
