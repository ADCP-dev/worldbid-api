import { Injectable } from '@nestjs/common';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';

@Injectable()
export class InstagramService {
  constructor(private readonly client: UploadPostClientService) {}

  async getMedia() { return this.client.getInstagramMedia(); }
  async getComments(postUrl: string) { return this.client.getInstagramComments(postUrl); }
  async replyToComment(commentId: string, message: string) { return this.client.replyToInstagramComment(commentId, message); }
  async sendDm(username: string, message: string) { return this.client.sendInstagramDm({ username, message }); }
  async getConversations() { return this.client.getInstagramDmConversations(); }
}