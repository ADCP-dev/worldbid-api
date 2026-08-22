import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { ModelEntity } from './entities/model.entity';
import { Model } from '../domain/model';
import { NullableType } from '@infra/utils/types/nullable.type';
import { CreateModelDto } from '../dto/create-model.dto';
import { UpdateModelDto } from '../dto/update-model.dto';

@Injectable()
export class ModelRepository {
  constructor(
    @InjectRepository(ModelEntity)
    private readonly repo: Repository<ModelEntity>,
  ) {}

  async create(data: CreateModelDto): Promise<Model> {
    const entity = this.repo.create({
      providerId: data.providerId,
      modelId: data.modelId,
      displayName: data.displayName,
      contextWindow: data.contextWindow,
      active: data.active ?? true,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<NullableType<Model>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByProviderId(providerId: string): Promise<Model[]> {
    const entities = await this.repo.find({
      where: { providerId },
      order: { displayName: 'ASC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async find(): Promise<Model[]> {
    const entities = await this.repo.find({
      order: { displayName: 'ASC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findActive(): Promise<Model[]> {
    const entities = await this.repo.find({
      where: { active: true },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async update(id: string, data: UpdateModelDto): Promise<Model> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Model ${id} not found`);
    }
    if (data.modelId !== undefined) entity.modelId = data.modelId;
    if (data.displayName !== undefined) entity.displayName = data.displayName;
    if (data.contextWindow !== undefined) entity.contextWindow = data.contextWindow;
    if (data.active !== undefined) entity.active = data.active;
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private toDomain(entity: ModelEntity): Model {
    return plainToInstance(Model, entity, {
      excludeExtraneousValues: true,
    });
  }
}