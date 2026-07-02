import type { ExtensionManifest } from '@core/extension-manifest.types';

const manifest: ExtensionManifest = {
  name: 'upload-post',
  version: '1.0.0',
  displayName: 'Upload-Post Social Media',
  description:
    'Social media automation via Upload-Post API. Multi-platform publishing, scheduling, analytics, AutoDMs, FFmpeg processing, and weekly reports.',
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
      // FFmpeg
      { method: 'POST', path: 'upload-post/ffmpeg/job' },
      { method: 'GET', path: 'upload-post/ffmpeg/job/:jobId' },
      { method: 'GET', path: 'upload-post/ffmpeg/usage' },
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
    ],
    entities: [
      { name: 'UpPost', table: 'ext_uploadpost_post' },
      { name: 'UpPostAnalyticsSnapshot', table: 'ext_uploadpost_analytics_snapshot' },
      { name: 'UpPostAutodmMonitor', table: 'ext_uploadpost_autodm_monitor' },
    ],
    seeds: false,
    config: ['upload-post'],
  },
};

export default manifest;
export { manifest };