import { Injectable, Logger } from '@nestjs/common';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly client: UploadPostClientService) {}

  async listScheduled() {
    return this.client.getScheduledPosts();
  }

  async update(jobId: string, updates: { scheduledDate?: string; title?: string; caption?: string }) {
    const payload: Record<string, any> = {};
    if (updates.scheduledDate) payload.scheduled_date = updates.scheduledDate;
    if (updates.title) payload.title = updates.title;
    if (updates.caption) payload.caption = updates.caption;
    return this.client.updateScheduledPost(jobId, payload);
  }

  async cancel(jobId: string) {
    return this.client.deleteScheduledPost(jobId);
  }
}