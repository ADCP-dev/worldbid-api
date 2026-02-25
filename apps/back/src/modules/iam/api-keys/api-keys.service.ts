import { Injectable } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { ApiKeyRepository } from '@iam/api-keys/infrastructure/api-key.repository';
import { ApiKey } from '@iam/api-keys/domain/api-key';
import { NullableType } from '@infra/utils/types/nullable.type';
import { User } from '@users/domain/user';

@Injectable()
export class ApiKeysService {
  constructor(private readonly apiKeyRepository: ApiKeyRepository) {}

  async validateApiKey(key: string): Promise<NullableType<User>> {
    const apiKey = await this.apiKeyRepository.findByKey(key);
    return apiKey?.user || null;
  }

  async findByUserId(userId: number): Promise<NullableType<ApiKey>> {
    return this.apiKeyRepository.findByUserId(userId);
  }

  async regenerateApiKey(userId: number): Promise<ApiKey> {
    // Generate a secure random API key
    const key = this.generateSecureKey();

    // Check if user already has an API key and remove it
    const existingApiKey = await this.apiKeyRepository.findByUserId(userId);
    if (existingApiKey) {
      await this.apiKeyRepository.remove(existingApiKey.id);
    }

    // Create new API key
    return this.apiKeyRepository.create({
      key,
      userId,
    });
  }

  async revokeApiKey(userId: number): Promise<void> {
    const apiKey = await this.apiKeyRepository.findByUserId(userId);
    if (apiKey) {
      await this.apiKeyRepository.remove(apiKey.id);
    }
  }

  private generateSecureKey(): string {
    // Generate a secure 32-character API key with prefix
    const prefix = 'ak_';
    const randomPart = randomStringGenerator();
    const timestamp = Date.now().toString(36);
    return `${prefix}${randomPart}${timestamp}`;
  }
}
