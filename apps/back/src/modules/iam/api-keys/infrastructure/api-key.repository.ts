import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToClass, plainToInstance } from 'class-transformer';
import { Repository } from 'typeorm';
import { ApiKeyEntity } from '@iam/api-keys/infrastructure/entities/api-key.entity';
import { NullableType } from '@infra/utils/types/nullable.type';
import { ApiKey } from '@iam/api-keys/domain/api-key';

@Injectable()
export class ApiKeyRepository {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepository: Repository<ApiKeyEntity>,
  ) {}

  async create(
    data: Omit<ApiKey, 'id' | 'createdAt' | 'updatedAt' | 'user'>,
  ): Promise<ApiKey> {
    const entity = plainToInstance(ApiKeyEntity, data);
    const newEntity = await this.apiKeyRepository.save(entity);
    return plainToClass(ApiKey, newEntity);
  }

  async findByKey(key: string): Promise<NullableType<ApiKey>> {
    const entity = await this.apiKeyRepository.findOne({
      where: { key },
      relations: ['user'],
    });

    return entity ? plainToClass(ApiKey, entity) : null;
  }

  async findByUserId(userId: number): Promise<NullableType<ApiKey>> {
    const entity = await this.apiKeyRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    return entity ? plainToClass(ApiKey, entity) : null;
  }

  async update(id: number, payload: Partial<ApiKey>): Promise<ApiKey | null> {
    const entity = await this.apiKeyRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    Object.assign(entity, payload);
    const updatedEntity = await this.apiKeyRepository.save(entity);

    return plainToClass(ApiKey, updatedEntity);
  }

  async remove(id: number): Promise<void> {
    await this.apiKeyRepository.delete(id);
  }
}
