import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { McpServerEntity } from './entities/mcp-server.entity';
import { McpServer } from '../domain/mcp-server';
import { NullableType } from '@infra/utils/types/nullable.type';
import { CreateMcpServerDto } from '../dto/create-mcp-server.dto';
import { UpdateMcpServerDto } from '../dto/update-mcp-server.dto';

@Injectable()
export class McpServerRepository {
  constructor(
    @InjectRepository(McpServerEntity)
    private readonly repo: Repository<McpServerEntity>,
  ) {}

  async create(data: CreateMcpServerDto): Promise<McpServer> {
    const entity = this.repo.create({
      agentConfigId: data.agentConfigId ?? null,
      name: data.name,
      transport: data.transport,
      url: data.url,
      apiKeyRef: data.apiKeyRef ?? null,
      enabled: data.enabled ?? true,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<NullableType<McpServer>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findEnabledByIds(ids: string[]): Promise<McpServer[]> {
    if (ids.length === 0) return [];
    const entities = await this.repo.find({
      where: ids.map((id) => ({ id, enabled: true })),
    });
    return entities.map((e) => this.toDomain(e));
  }

  async find(): Promise<McpServer[]> {
    const entities = await this.repo.find({ order: { name: 'ASC' } });
    return entities.map((e) => this.toDomain(e));
  }

  async update(id: string, data: UpdateMcpServerDto): Promise<McpServer> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`McpServer ${id} not found`);
    }
    if (data.agentConfigId !== undefined) entity.agentConfigId = data.agentConfigId;
    if (data.name !== undefined) entity.name = data.name;
    if (data.transport !== undefined) entity.transport = data.transport;
    if (data.url !== undefined) entity.url = data.url;
    if (data.apiKeyRef !== undefined) entity.apiKeyRef = data.apiKeyRef;
    if (data.enabled !== undefined) entity.enabled = data.enabled;
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private toDomain(entity: McpServerEntity): McpServer {
    return plainToInstance(McpServer, entity, {
      excludeExtraneousValues: true,
    });
  }
}