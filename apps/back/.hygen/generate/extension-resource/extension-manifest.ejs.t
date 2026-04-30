---
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/extension.manifest.ts
---
import type { ExtensionManifest } from '@core/extension-manifest.types';

const manifest: ExtensionManifest = {
  name: '<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>',
  version: '1.0.0',
  displayName: '<%= h.inflection.humanize(name) %>',
  description: 'Auto-generated extension for <%= h.inflection.humanize(name) %>.',
  author: '',
  engines: {
    foundation: '>=1.0.0',
    node: '>=18.0.0',
  },
  contributes: {
    routes: [
      // { method: 'GET', path: '<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>' },
      // { method: 'POST', path: '<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>' },
      // { method: 'GET', path: '<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/:id' },
      // { method: 'PATCH', path: '<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/:id' },
      // { method: 'DELETE', path: '<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/:id' },
    ],
    entities: [
      // { name: '<%= name %>', table: '<%= h.inflection.transform(name, ['underscore']) %>' },
    ],
    seeds: false,
    config: [],
    menuItems: [],
    permissions: [],
  },
};

export default manifest;
export { manifest };
