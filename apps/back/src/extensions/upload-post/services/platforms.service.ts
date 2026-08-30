import { Injectable } from '@nestjs/common';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';

@Injectable()
export class PlatformsService {
  constructor(private readonly client: UploadPostClientService) {}

  async getFacebookPages() {
    return this.client.getFacebookPages();
  }
  async getLinkedinPages() {
    return this.client.getLinkedinPages();
  }
  async getPinterestBoards() {
    return this.client.getPinterestBoards();
  }
  async getGoogleBusinessLocations() {
    return this.client.getGoogleBusinessLocations();
  }
  async selectGoogleBusinessLocation(locationId: string) {
    return this.client.selectGoogleBusinessLocation(locationId);
  }
  async getCurrentUser() {
    return this.client.getCurrentUser();
  }
  async getRedditDetailedPost(postId: string) {
    return this.client.getRedditDetailedPost(postId);
  }
}
