export class Subscription {
  id: string;
  stripeId?: string;
  userId: number;
  planId: string;
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
}
