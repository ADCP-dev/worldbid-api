import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyEntity } from './entities/api-key.entity';
import { NullableType } from '../../utils/types/nullable.type';
import { ApiKey } from '../domain/api-key';
import { ApiKeyMapper } from './mappers/api-key.mapper';

@Injectable()
export class ApiKeyRepository {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepository: Repository<ApiKeyEntity>,
  ) {}

  async create(
    data: Omit<ApiKey, 'id' | 'createdAt' | 'updatedAt' | 'user'>,
  ): Promise<ApiKey> {
    const persistenceModel = ApiKeyMapper.toPersistence(data as ApiKey);
    const newEntity = await this.apiKeyRepository.save(
      this.apiKeyRepository.create(persistenceModel),
    );
    return ApiKeyMapper.toDomain(newEntity);
  }

  async findByKey(key: string): Promise<NullableType<ApiKey>> {
    const entity = await this.apiKeyRepository.findOne({
      where: { key },
      relations: ['user'],
    });

    return entity ? ApiKeyMapper.toDomain(entity) : null;
  }

  async findByUserId(userId: number): Promise<NullableType<ApiKey>> {
    const entity = await this.apiKeyRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    return entity ? ApiKeyMapper.toDomain(entity) : null;
  }

  async update(id: number, payload: Partial<ApiKey>): Promise<ApiKey | null> {
    const entity = await this.apiKeyRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.apiKeyRepository.save(
      this.apiKeyRepository.create(
        ApiKeyMapper.toPersistence({
          ...ApiKeyMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ApiKeyMapper.toDomain(updatedEntity);
  }

  async remove(id: number): Promise<void> {
    await this.apiKeyRepository.delete(id);
  }
}
