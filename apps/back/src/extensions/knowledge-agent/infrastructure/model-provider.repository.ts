import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { ModelProviderEntity } from './entities/model-provider.entity';
import { ModelProvider } from '../domain/model-provider';
import { NullableType } from '@infra/utils/types/nullable.type';
import { CreateModelProviderDto } from '../dto/create-model-provider.dto';
import { UpdateModelProviderDto } from '../dto/update-model-provider.dto';

@Injectable()
export class ModelProviderRepository {
  constructor(
    @InjectRepository(ModelProviderEntity)
    private readonly repo: Repository<ModelProviderEntity>,
  ) {}

  async create(data: CreateModelProviderDto): Promise<ModelProvider> {
    const entity = this.repo.create({
      name: data.name,
      provider: data.provider,
      apiKeyRef: data.apiKeyRef ?? null,
      baseUrl: data.baseUrl ?? null,
      enabled: data.enabled ?? true,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<NullableType<ModelProvider>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async find(): Promise<ModelProvider[]> {
    const entities = await this.repo.find({ order: { createdAt: 'ASC' } });
    return entities.map((e) => this.toDomain(e));
  }

  async findByProvider(provider: string): Promise<NullableType<ModelProvider>> {
    const entity = await this.repo.findOne({
      where: { provider, enabled: true },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async update(
    id: string,
    data: UpdateModelProviderDto,
  ): Promise<ModelProvider> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`ModelProvider ${id} not found`);
    }
    if (data.name !== undefined) entity.name = data.name;
    if (data.apiKeyRef !== undefined) entity.apiKeyRef = data.apiKeyRef;
    if (data.baseUrl !== undefined) entity.baseUrl = data.baseUrl;
    if (data.enabled !== undefined) entity.enabled = data.enabled;
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private toDomain(entity: ModelProviderEntity): ModelProvider {
    return plainToInstance(ModelProvider, entity, {
      excludeExtraneousValues: true,
    });
  }
}