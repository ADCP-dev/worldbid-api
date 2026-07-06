import type { ExtensionManifest } from '@core/extension-manifest.types';

const manifest: ExtensionManifest = {
  name: 'content-pipeline',
  version: '1.0.0',
  displayName: 'Content Pipeline',
  description:
    'Autonomous content generation pipeline: research → ideas → drafts → publish. Multi-nicho. Integrates optionally with CMS, Upload-Post, and Affiliate extensions.',
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
      // Projects
      { method: 'GET', path: 'content-pipeline/projects' },
      { method: 'POST', path: 'content-pipeline/projects' },
      { method: 'GET', path: 'content-pipeline/projects/:id' },
      { method: 'PATCH', path: 'content-pipeline/projects/:id' },
      { method: 'DELETE', path: 'content-pipeline/projects/:id' },
      // Ideas
      { method: 'GET', path: 'content-pipeline/projects/:id/ideas' },
      { method: 'POST', path: 'content-pipeline/projects/:id/ideas' },
      { method: 'POST', path: 'content-pipeline/projects/:id/ideas/research' },
      { method: 'GET', path: 'content-pipeline/ideas/:id' },
      { method: 'PATCH', path: 'content-pipeline/ideas/:id' },
      { method: 'PATCH', path: 'content-pipeline/ideas/:id/status' },
      { method: 'POST', path: 'content-pipeline/ideas/reorder' },
      { method: 'DELETE', path: 'content-pipeline/ideas/:id' },
      { method: 'POST', path: 'content-pipeline/ideas/:id/generate' },
      // Drafts
      { method: 'GET', path: 'content-pipeline/projects/:id/drafts' },
      { method: 'GET', path: 'content-pipeline/drafts/:id' },
      { method: 'PATCH', path: 'content-pipeline/drafts/:id' },
      { method: 'POST', path: 'content-pipeline/drafts/:id/approve' },
      { method: 'POST', path: 'content-pipeline/drafts/:id/reject' },
      { method: 'POST', path: 'content-pipeline/drafts/:id/publish' },
      { method: 'POST', path: 'content-pipeline/drafts/:id/generate-video' },
      {
        method: 'POST',
        path: 'content-pipeline/drafts/:id/generate-carousel-video',
      },
      // Video jobs (async)
      { method: 'GET', path: 'content-pipeline/video-jobs/:jobId' },
      // Video templates
      { method: 'GET', path: 'content-pipeline/templates' },
      { method: 'GET', path: 'content-pipeline/templates/:type' },
      { method: 'POST', path: 'content-pipeline/templates/generate' },
      // CTA videos
      { method: 'GET', path: 'content-pipeline/cta-videos' },
      { method: 'GET', path: 'content-pipeline/cta-videos/active' },
      { method: 'GET', path: 'content-pipeline/cta-videos/:id' },
      { method: 'POST', path: 'content-pipeline/cta-videos' },
      { method: 'PATCH', path: 'content-pipeline/cta-videos/:id' },
      { method: 'DELETE', path: 'content-pipeline/cta-videos/:id' },
      // Metrics
      { method: 'GET', path: 'content-pipeline/projects/:id/metrics' },
      { method: 'GET', path: 'content-pipeline/metrics/dashboard' },
    ],
    entities: [
      { name: 'CpProject', table: 'ext_cp_project' },
      { name: 'CpIdea', table: 'ext_cp_idea' },
      { name: 'CpDraft', table: 'ext_cp_draft' },
      { name: 'CpMetrics', table: 'ext_cp_metrics' },
      { name: 'CpCtaVideo', table: 'ext_cp_cta_video' },
    ],
    seeds: false,
    config: ['content-pipeline'],
  },
};

export default manifest;
export { manifest };
