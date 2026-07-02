import type { ExtensionManifest } from '@core/extension-manifest.types';

const manifest: ExtensionManifest = {
  name: 'upload-post',
  version: '1.0.0',
  displayName: 'Upload-Post Social Media',
  description:
    'Social media automation via Upload-Post API. Multi-platform publishing, scheduling, analytics, AutoDMs, and weekly reports. Admin-only.',
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
      // Upload
      { method: 'POST', path: 'upload-post/upload/video' },
      { method: 'POST', path: 'upload-post/upload/photo' },
      { method: 'POST', path: 'upload-post/upload/text' },
      { method: 'GET', path: 'upload-post/upload/status' },
      { method: 'GET', path: 'upload-post/history' },
      // Schedule
      { method: 'GET', path: 'upload-post/schedule' },
      { method: 'PATCH', path: 'upload-post/schedule/:jobId' },
      { method: 'DELETE', path: 'upload-post/schedule/:jobId' },
      // Analytics
      { method: 'GET', path: 'upload-post/analytics/:profileUsername' },
      { method: 'GET', path: 'upload-post/analytics/total-impressions/:profileUsername' },
      { method: 'GET', path: 'upload-post/analytics/post/:requestId' },
      { method: 'GET', path: 'upload-post/analytics/platform-metrics' },
      // AutoDM
      { method: 'POST', path: 'upload-post/autodms/start' },
      { method: 'GET', path: 'upload-post/autodms/status' },
      { method: 'GET', path: 'upload-post/autodms/logs' },
      { method: 'POST', path: 'upload-post/autodms/pause' },
      { method: 'POST', path: 'upload-post/autodms/resume' },
      { method: 'POST', path: 'upload-post/autodms/stop' },
      { method: 'POST', path: 'upload-post/autodms/delete' },
      // Webhooks
      { method: 'POST', path: 'upload-post/webhooks/configure' },
      // Queue
      { method: 'GET', path: 'upload-post/queue/preview' },
      { method: 'GET', path: 'upload-post/queue/next-slot' },
      { method: 'GET', path: 'upload-post/queue/settings' },
      { method: 'POST', path: 'upload-post/queue/settings' },
      // Weekly report
      { method: 'GET', path: 'upload-post/weekly-report' },
      { method: 'POST', path: 'upload-post/weekly-report/send' },
      // Platforms
      { method: 'GET', path: 'upload-post/platforms/facebook/pages' },
      { method: 'GET', path: 'upload-post/platforms/linkedin/pages' },
      { method: 'GET', path: 'upload-post/platforms/pinterest/boards' },
      { method: 'GET', path: 'upload-post/platforms/google-business/locations' },
      { method: 'POST', path: 'upload-post/platforms/google-business/locations/select' },
      { method: 'GET', path: 'upload-post/platforms/reddit/detailed-posts/:postId' },
      // Instagram
      { method: 'GET', path: 'upload-post/instagram/media' },
      { method: 'GET', path: 'upload-post/instagram/comments' },
      { method: 'POST', path: 'upload-post/instagram/comments/reply' },
      { method: 'POST', path: 'upload-post/instagram/dms/send' },
      { method: 'GET', path: 'upload-post/instagram/dms/conversations' },
      // Content Ideas
      { method: 'GET', path: 'upload-post/ideas' },
      { method: 'POST', path: 'upload-post/ideas' },
      { method: 'PATCH', path: 'upload-post/ideas/:id' },
      { method: 'DELETE', path: 'upload-post/ideas/:id' },
      { method: 'PATCH', path: 'upload-post/ideas/:id/status' },
      { method: 'POST', path: 'upload-post/ideas/reorder' },
      // Monthly Analytics
      { method: 'GET', path: 'upload-post/monthly-analytics/summary/:month' },
      { method: 'GET', path: 'upload-post/monthly-analytics/history' },
      { method: 'GET', path: 'upload-post/monthly-analytics/top-posts' },
      { method: 'GET', path: 'upload-post/monthly-analytics/top-posts/:month' },
    ],
    entities: [
      { name: 'UpPost', table: 'ext_uploadpost_post' },
      { name: 'UpPostAnalyticsSnapshot', table: 'ext_uploadpost_analytics_snapshot' },
      { name: 'UpPostAutodmMonitor', table: 'ext_uploadpost_autodm_monitor' },
      { name: 'UpPostContentIdea', table: 'ext_uploadpost_content_idea' },
    ],
    seeds: false,
    config: ['upload-post'],
  },
};

export default manifest;
export { manifest };