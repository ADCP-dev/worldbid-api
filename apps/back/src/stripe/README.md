# Stripe Integration

This module provides a complete Stripe integration for the NestJS application, including checkout sessions, customer portal, and webhook handling.

## Features

- **Checkout Sessions**: Create secure payment sessions for subscriptions
- **Customer Portal**: Allow customers to manage their subscriptions and billing
- **Webhooks**: Handle Stripe events like subscription updates, payments, etc.
- **Subscription Management**: Get subscription status and manage cancellations

## Setup

### Environment Variables

Add the following to your `.env` file:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_DOMAIN=http://localhost:3000
```

### Webhook Configuration

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Create a new webhook endpoint pointing to: `https://your-domain.com/stripe/webhook`
3. Select the following events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

## API Endpoints

### Create Checkout Session
```http
POST /stripe/create-checkout-session
Content-Type: application/json

{
  "lookupKey": "price_lookup_key",
  "customerEmail": "customer@example.com",
  "metadata": {
    "userId": "12345"
  }
}
```

### Create Portal Session
```http
POST /stripe/create-portal-session
Content-Type: application/json

{
  "sessionId": "cs_test_..."
}
```

### Create Customer Portal
```http
POST /stripe/create-customer-portal
Content-Type: application/json

{
  "customerId": "cus_..."
}
```

### Get Subscription Status
```http
POST /stripe/subscription-status
Content-Type: application/json

{
  "customerId": "cus_..."
}
```

## Usage Example

```typescript
import { StripeService } from './stripe/stripe.service';

export class MyService {
  constructor(private readonly stripeService: StripeService) {}

  async createSubscription(userId: string, email: string) {
    const session = await this.stripeService.createCheckoutSession(
      'premium_plan',
      email,
      { userId }
    );
    
    return session.url;
  }
}
```

## Webhook Handling

The webhook handler automatically processes common events. You can extend the `StripeService` to add custom business logic:

```typescript
// In stripe.service.ts
private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  // Add your custom logic here
  await this.userService.activateSubscription(subscription.customer as string);
}
```

## Testing

Use Stripe's test cards:
- **Success**: `4242 4242 4242 4242`
- **Requires 3D Secure**: `4000 0025 0000 3155`
- **Decline**: `4000 0000 0000 0002`

Use any future expiry date and any 3-digit CVC for testing.