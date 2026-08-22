import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { ChatSessionEntity } from './entities/chat-session.entity';
import { ChatSession } from '../domain/chat-session';
import { NullableType } from '@infra/utils/types/nullable.type';
import { CreateChatSessionDto } from '../dto/create-chat-session.dto';
import { UpdateChatSessionDto } from '../dto/update-chat-session.dto';

@Injectable()
export class ChatSessionRepository {
  constructor(
    @InjectRepository(ChatSessionEntity)
    private readonly repo: Repository<ChatSessionEntity>,
  ) {}

  async create(
    data: CreateChatSessionDto & { userId: number },
  ): Promise<ChatSession> {
    const entity = this.repo.create({
      userId: data.userId,
      agentConfigId: data.agentConfigId ?? null,
      title: data.title ?? 'New Chat',
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<NullableType<ChatSession>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByUserId(userId: number): Promise<ChatSession[]> {
    const entities = await this.repo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async update(
    id: string,
    data: UpdateChatSessionDto,
  ): Promise<ChatSession> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`ChatSession ${id} not found`);
    }
    if (data.title !== undefined) entity.title = data.title;
    if (data.agentConfigId !== undefined) entity.agentConfigId = data.agentConfigId;
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  /**
   * Returns true if `id` belongs to `userId`. Used by the ChatService for
   * the cross-user 403 check before any mutation.
   */
  async verifyOwnership(id: string, userId: number): Promise<boolean> {
    const entity = await this.repo.findOne({
      where: { id },
      select: ['userId'],
    });
    if (!entity) return false;
    return entity.userId === userId;
  }

  private toDomain(entity: ChatSessionEntity): ChatSession {
    return plainToInstance(ChatSession, entity, {
      excludeExtraneousValues: true,
    });
  }
}