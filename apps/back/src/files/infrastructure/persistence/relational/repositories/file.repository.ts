import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FileEntity } from '../entities/file.entity';
import { In, Repository } from 'typeorm';
import { FileRepository } from '../../file.repository';

import { FileMapper } from '../mappers/file.mapper';
import { FileType } from '../../../../domain/file';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FileFilterDto } from '../../../../dto/file-filter.dto';

@Injectable()
export class FileRelationalRepository implements FileRepository {
  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
  ) {}

  async create(data: FileType): Promise<FileType> {
    const persistenceModel = FileMapper.toPersistence(data);
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
    const where: any = {};

    if (filters.entity !== undefined) {
      where.entity = filters.entity;
    }

    if (filters.entityId !== undefined) {
      where.entityId = filters.entityId;
    }

    if (filters.userId !== undefined) {
      where.userId = filters.userId;
    }

    if (filters.type !== undefined) {
      where.type = filters.type;
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
    await this.fileRepository.delete(id);
  }
}
