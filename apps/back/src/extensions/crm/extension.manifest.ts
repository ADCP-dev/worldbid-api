import type { ExtensionManifest } from '@core/extension-manifest.types';

const manifest: ExtensionManifest = {
  name: 'crm',
  version: '1.0.0',
  displayName: 'CRM',
  description:
    'Client relationship management with clients, contacts, interactions, projects, statuses, origins, and dashboard analytics.',
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
      // Clients
      { method: 'GET', path: 'crm/clients' },
      { method: 'POST', path: 'crm/clients' },
      { method: 'GET', path: 'crm/clients/:id' },
      { method: 'PATCH', path: 'crm/clients/:id' },
      { method: 'DELETE', path: 'crm/clients/:id' },
      // Contacts (nested under clients)
      { method: 'GET', path: 'crm/clients/:clientId/contacts' },
      { method: 'POST', path: 'crm/clients/:clientId/contacts' },
      { method: 'PATCH', path: 'crm/clients/:clientId/contacts/:id' },
      { method: 'DELETE', path: 'crm/clients/:clientId/contacts/:id' },
      // Interactions (nested under clients)
      { method: 'GET', path: 'crm/clients/:clientId/interactions' },
      { method: 'POST', path: 'crm/clients/:clientId/interactions' },
      { method: 'PATCH', path: 'crm/clients/:clientId/interactions/:id' },
      { method: 'DELETE', path: 'crm/clients/:clientId/interactions/:id' },
      // Projects
      { method: 'GET', path: 'crm/projects' },
      { method: 'POST', path: 'crm/projects' },
      { method: 'GET', path: 'crm/projects/:id' },
      { method: 'PATCH', path: 'crm/projects/:id' },
      { method: 'DELETE', path: 'crm/projects/:id' },
      // Statuses
      { method: 'GET', path: 'crm/statuses' },
      { method: 'POST', path: 'crm/statuses' },
      { method: 'PATCH', path: 'crm/statuses/:id' },
      { method: 'DELETE', path: 'crm/statuses/:id' },
      // Origins
      { method: 'GET', path: 'crm/origins' },
      { method: 'POST', path: 'crm/origins' },
      { method: 'PATCH', path: 'crm/origins/:id' },
      { method: 'DELETE', path: 'crm/origins/:id' },
      // Dashboard
      { method: 'GET', path: 'crm/dashboard' },
    ],
    entities: [
      { name: 'CrmStatus', table: 'ext_crm_status' },
      { name: 'CrmOrigin', table: 'ext_crm_origin' },
      { name: 'CrmClient', table: 'ext_crm_client' },
      { name: 'CrmContact', table: 'ext_crm_contact' },
      { name: 'CrmInteraction', table: 'ext_crm_interaction' },
      { name: 'CrmProject', table: 'ext_crm_project' },
    ],
    seeds: true,
    config: [],
  },
};

export default manifest;
export { manifest };
