import type { ExtensionManifest } from '@core/extension-manifest.types';

const manifest: ExtensionManifest = {
  name: 'affiliate',
  version: '1.0.0',
  displayName: 'Affiliate',
  description:
    'Affiliate program management with partners, referrals, commissions, dashboard analytics, and a self-service portal for affiliates.',
  author: 'Foundation Team',
  engines: {
    foundation: '>=1.0.0',
    node: '>=18.0.0',
  },
  dependencies: {
    extensions: ['crm'],
  },
  contributes: {
    routes: [
      // Partners (admin)
      { method: 'GET', path: 'affiliate/partners' },
      { method: 'POST', path: 'affiliate/partners' },
      { method: 'GET', path: 'affiliate/partners/:id' },
      { method: 'PATCH', path: 'affiliate/partners/:id' },
      { method: 'DELETE', path: 'affiliate/partners/:id' },
      { method: 'POST', path: 'affiliate/partners/:id/invite' },
      // Referrals (admin)
      { method: 'GET', path: 'affiliate/referrals' },
      { method: 'POST', path: 'affiliate/referrals' },
      { method: 'PATCH', path: 'affiliate/referrals/:id' },
      { method: 'DELETE', path: 'affiliate/referrals/:id' },
      // Commissions (admin)
      { method: 'GET', path: 'affiliate/commissions' },
      { method: 'POST', path: 'affiliate/commissions' },
      { method: 'PATCH', path: 'affiliate/commissions/:id' },
      { method: 'GET', path: 'affiliate/commissions/summary' },
      // Dashboard (admin)
      { method: 'GET', path: 'affiliate/dashboard' },
      // Portal (affiliate role)
      { method: 'GET', path: 'affiliate/portal/me' },
      { method: 'PATCH', path: 'affiliate/portal/me' },
      { method: 'GET', path: 'affiliate/portal/referrals' },
      { method: 'POST', path: 'affiliate/portal/referrals' },
      { method: 'GET', path: 'affiliate/portal/referrals/:id' },
      { method: 'GET', path: 'affiliate/portal/commissions' },
      { method: 'GET', path: 'affiliate/portal/summary' },
    ],
    entities: [
      { name: 'AffiliatePartner', table: 'ext_affiliate_partner' },
      { name: 'AffiliateReferral', table: 'ext_affiliate_referral' },
      { name: 'AffiliateCommission', table: 'ext_affiliate_commission' },
    ],
    seeds: false,
    config: [],
  },
};

export default manifest;
export { manifest };