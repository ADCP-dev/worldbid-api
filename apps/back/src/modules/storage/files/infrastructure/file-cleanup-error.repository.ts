import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { FileCleanupErrorEntity } from '@storage/files/infrastructure/entities/file-cleanup-error.entity';

@Injectable()
export class FileCleanupErrorRepository {
  constructor(
    @InjectRepository(FileCleanupErrorEntity)
    private readonly repository: Repository<FileCleanupErrorEntity>,
  ) {}

  async save(
    entity: Partial<FileCleanupErrorEntity>,
  ): Promise<FileCleanupErrorEntity> {
    const errorEntity = this.repository.create(entity);
    return this.repository.save(errorEntity);
  }

  async findPending(limit: number): Promise<FileCleanupErrorEntity[]> {
    return this.repository.find({
      take: limit,
      where: {
        attempts: LessThan(5),
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async remove(entity: FileCleanupErrorEntity): Promise<void> {
    await this.repository.remove(entity);
  }

  // To support raw repository access
  get typeOrmRepository(): Repository<FileCleanupErrorEntity> {
    return this.repository;
  }
}
