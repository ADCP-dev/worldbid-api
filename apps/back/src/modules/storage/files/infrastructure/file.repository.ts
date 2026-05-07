import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FileEntity } from '@storage/files/infrastructure/entities/file.entity';
import { In, Repository } from 'typeorm';
import { plainToClass, plainToInstance } from 'class-transformer';

import { FileType } from '@storage/files/domain/file';
import { NullableType } from '@infra/utils/types/nullable.type';
import { FileFilterDto } from '@storage/files/dto/file-filter.dto';

@Injectable()
export class FileRepository {
  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
  ) {}

  async create(data: Omit<FileType, 'id'>): Promise<FileType> {
    const entity = plainToInstance(FileEntity, data);
    const newEntity = await this.fileRepository.save(entity);
    return plainToClass(FileType, newEntity);
  }

  async findById(id: FileType['id']): Promise<NullableType<FileType>> {
    const entity = await this.fileRepository.findOne({
      where: {
        id: id,
      },
    });

    return entity ? plainToClass(FileType, entity) : null;
  }

  async findByIds(ids: FileType['id'][]): Promise<FileType[]> {
    const entities = await this.fileRepository.find({
      where: {
        id: In(ids),
      },
    });

    return entities.map((entity) => plainToClass(FileType, entity));
  }

  async findWithFilters(
    filters: FileFilterDto,
  ): Promise<{ data: FileType[]; total: number }> {
    const { entityName, entityId, context, userId, type, page, limit } =
      filters;
    const where: any = {};

    if (entityName !== undefined) {
      where.entityName = entityName;
    }

    if (entityId !== undefined) {
      where.entityId = entityId;
    }

    if (context !== undefined) {
      where.context = context;
    }

    if (userId !== undefined) {
      where.userId = userId;
    }

    if (type !== undefined) {
      where.type = type;
    }

    const skip = page && limit ? (page - 1) * limit : undefined;
    const take = limit || undefined;

    const [entities, total] = await this.fileRepository.findAndCount({
      where,
      skip,
      take,
    });

    return {
      data: entities.map((entity) => plainToClass(FileType, entity)),
      total,
    };
  }

  async update(
    id: FileType['id'],
    data: Partial<Omit<FileType, 'id'>>,
  ): Promise<FileType> {
    await this.fileRepository.update(id, data);

    const updatedEntity = await this.fileRepository.findOne({
      where: { id },
    });

    if (!updatedEntity) {
      throw new Error(`File with id ${id} not found`);
    }

    return plainToClass(FileType, updatedEntity);
  }

  async delete(id: FileType['id']): Promise<void> {
    const entity = await this.fileRepository.findOne({ where: { id } });
    if (entity) {
      await this.fileRepository.remove(entity);
    }
  }
}
