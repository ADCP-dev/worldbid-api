import { Injectable, Logger } from '@nestjs/common';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(private readonly client: UploadPostClientService) {}

  async preview() {
    return this.client.getQueuePreview();
  }

  async nextSlot() {
    return this.client.getQueueNextSlot();
  }

  async getSettings() {
    return this.client.getQueueSettings();
  }

  async updateSettings(settings: Record<string, unknown>) {
    return this.client.updateQueueSettings(settings);
  }
}
