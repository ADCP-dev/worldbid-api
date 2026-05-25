import type { ExtensionManifest } from '@core/extension-manifest.types';

const manifest: ExtensionManifest = {
  name: 'stripe',
  version: '1.0.0',
  displayName: 'Stripe Billing',
  description:
    'Stripe billing integration with products, prices, plans, subscriptions, and usage records.',
  author: 'Foundation Team',
  engines: {
    foundation: '>=1.0.0',
    node: '>=18.0.0',
  },
  dependencies: {
    extensions: [],
  },
  contributes: {
    routes: [
      { method: 'GET', path: 'stripe/products' },
      { method: 'POST', path: 'stripe/products' },
      { method: 'GET', path: 'stripe/products/:id' },
      { method: 'PATCH', path: 'stripe/products/:id' },
      { method: 'DELETE', path: 'stripe/products/:id' },
      { method: 'GET', path: 'stripe/prices' },
      { method: 'POST', path: 'stripe/prices' },
      { method: 'GET', path: 'stripe/prices/:id' },
      { method: 'PATCH', path: 'stripe/prices/:id' },
      { method: 'DELETE', path: 'stripe/prices/:id' },
      { method: 'GET', path: 'stripe/plans' },
      { method: 'POST', path: 'stripe/plans' },
      { method: 'GET', path: 'stripe/plans/:id' },
      { method: 'PATCH', path: 'stripe/plans/:id' },
      { method: 'DELETE', path: 'stripe/plans/:id' },
      { method: 'GET', path: 'stripe/subscriptions' },
      { method: 'POST', path: 'stripe/subscriptions' },
      { method: 'GET', path: 'stripe/subscriptions/:id' },
      { method: 'PATCH', path: 'stripe/subscriptions/:id' },
      { method: 'DELETE', path: 'stripe/subscriptions/:id' },
      { method: 'POST', path: 'stripe/webhooks' },
      { method: 'POST', path: 'stripe/test/payment' },
    ],
    entities: [
      { name: 'Product', table: 'ext_stripe_product' },
      { name: 'Price', table: 'ext_stripe_price' },
      { name: 'Plan', table: 'ext_stripe_plan' },
      { name: 'Subscription', table: 'ext_stripe_subscription' },
      { name: 'UsageRecord', table: 'ext_stripe_usage_record' },
    ],
    seeds: true,
    config: ['stripe'],
  },
};

export default manifest;
export { manifest };
