import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FileEntity } from '@storage/files/infrastructure/entities/file.entity';
import { In, Repository } from 'typeorm';

import { FileMapper } from '@storage/files/infrastructure/mappers/file.mapper';
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
    const persistenceModel = FileMapper.toPersistence(data as FileType);
    return this.fileRepository.save(
      this.fileRepository.create(persistenceModel),
    );
  }

  async findById(id: FileType['id']): Promise<NullableType<FileType>> {
    const entity = await this.fileRepository.findOne({
      where: {
        id: id,
      },
    });

    return entity ? FileMapper.toDomain(entity) : null;
  }

  async findByIds(ids: FileType['id'][]): Promise<FileType[]> {
    const entities = await this.fileRepository.find({
      where: {
        id: In(ids),
      },
    });

    return entities.map((entity) => FileMapper.toDomain(entity));
  }

  async findWithFilters(filters: FileFilterDto): Promise<FileType[]> {
    const { entityName, entityId, context, userId, type } = filters;
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

    const entities = await this.fileRepository.find({ where });

    return entities.map((entity) => FileMapper.toDomain(entity));
  }

  async update(
    id: FileType['id'],
    data: Partial<Omit<FileType, 'id'>>,
  ): Promise<FileType> {
    await this.fileRepository.update(
      id,
      FileMapper.toPersistence(data as FileType),
    );

    const updatedEntity = await this.fileRepository.findOne({
      where: { id },
    });

    if (!updatedEntity) {
      throw new Error(`File with id ${id} not found`);
    }

    return FileMapper.toDomain(updatedEntity);
  }

  async delete(id: FileType['id']): Promise<void> {
    const entity = await this.fileRepository.findOne({ where: { id } });
    if (entity) {
      await this.fileRepository.remove(entity);
    }
  }
}
