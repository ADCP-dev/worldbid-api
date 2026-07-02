export type UploadPostConfig = {
  apiKey?: string;
  apiUrl: string;
  webhookSecret?: string;
  profileUsername?: string;
  weeklyReportCron?: string;
  weeklyReportEmail?: string;
  weeklyReportTelegramChatId?: string;
};

export const DEFAULT_WEEKLY_REPORT_CRON = '0 9 * * 1'; // Lunes 09:00
export const UPLOAD_POST_API_BASE = 'https://api.upload-post.com';