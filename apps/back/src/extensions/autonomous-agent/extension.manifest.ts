import type { ExtensionManifest } from '@core/extension-manifest.types';

const manifest: ExtensionManifest = {
  name: 'autonomous-agent',
  version: '1.0.0',
  displayName: 'Autonomous Agent',
  description:
    'Brain that schedules and monitors the content-pipeline via BullMQ and @Cron. Orchestrates research → generate → publish → metrics runs, runs the feedback loop, and emits notifications.',
  author: 'SOM-OS',
  engines: {
    foundation: '>=1.0.0',
    node: '>=18.0.0',
  },
  dependencies: {
    extensions: [],
  },
  contributes: {
    routes: [
      // Config
      { method: 'GET', path: 'autonomous-agent/configs' },
      { method: 'POST', path: 'autonomous-agent/configs' },
      { method: 'GET', path: 'autonomous-agent/configs/:id' },
      { method: 'PATCH', path: 'autonomous-agent/configs/:id' },
      { method: 'POST', path: 'autonomous-agent/configs/:id/pause' },
      { method: 'POST', path: 'autonomous-agent/configs/:id/resume' },
      { method: 'DELETE', path: 'autonomous-agent/configs/:id' },
      // Runs
      { method: 'GET', path: 'autonomous-agent/runs' },
      { method: 'GET', path: 'autonomous-agent/runs/:id' },
    ],
    entities: [
      { name: 'AaConfig', table: 'ext_aa_config' },
      { name: 'AaRun', table: 'ext_aa_run' },
    ],
    seeds: false,
    config: ['autonomous-agent'],
  },
};

export default manifest;
export { manifest };