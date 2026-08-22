import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { AgentConfigEntity } from './entities/agent-config.entity';
import { AgentConfig } from '../domain/agent-config';
import { NullableType } from '@infra/utils/types/nullable.type';
import { CreateAgentConfigDto } from '../dto/create-agent-config.dto';
import { UpdateAgentConfigDto } from '../dto/update-agent-config.dto';

@Injectable()
export class AgentConfigRepository {
  constructor(
    @InjectRepository(AgentConfigEntity)
    private readonly repo: Repository<AgentConfigEntity>,
  ) {}

  async create(
    data: CreateAgentConfigDto & { userId?: number | null },
  ): Promise<AgentConfig> {
    const entity = this.repo.create({
      name: data.name,
      systemPrompt: data.systemPrompt,
      model: data.model,
      provider: data.provider,
      permissions: data.permissions ?? { allow: [], deny: [] },
      mcpServerIds: data.mcpServerIds ?? [],
      userId: data.userId ?? null,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<NullableType<AgentConfig>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  /**
   * List all configs (global). Never scoped by user — configs are shared.
   */
  async findAll(): Promise<AgentConfig[]> {
    const entities = await this.repo.find({
      order: { updatedAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async update(id: string, data: UpdateAgentConfigDto): Promise<AgentConfig> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`AgentConfig ${id} not found`);
    }
    if (data.name !== undefined) entity.name = data.name;
    if (data.systemPrompt !== undefined) entity.systemPrompt = data.systemPrompt;
    if (data.model !== undefined) entity.model = data.model;
    if (data.provider !== undefined) entity.provider = data.provider;
    if (data.permissions !== undefined) entity.permissions = data.permissions;
    if (data.mcpServerIds !== undefined) entity.mcpServerIds = data.mcpServerIds;
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private toDomain(entity: AgentConfigEntity): AgentConfig {
    return plainToInstance(AgentConfig, entity, {
      excludeExtraneousValues: true,
    });
  }
}