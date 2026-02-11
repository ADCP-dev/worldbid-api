import { Injectable } from '@nestjs/common';

import { FileRepository } from './infrastructure/persistence/file.repository';
import { FileType } from './domain/file';
import { NullableType } from '../utils/types/nullable.type';
import { FileFilterDto } from './dto/file-filter.dto';

@Injectable()
export class FilesService {
  constructor(private readonly fileRepository: FileRepository) {}

  findById(id: FileType['id']): Promise<NullableType<FileType>> {
    return this.fileRepository.findById(id);
  }

  findByIds(ids: FileType['id'][]): Promise<FileType[]> {
    return this.fileRepository.findByIds(ids);
  }

  async findWithFilters(filters: FileFilterDto): Promise<FileType[]> {
    // Validate that if entityId is provided, entity must also be provided
    if (filters.entityId !== undefined && filters.entity === undefined) {
      throw new Error('Entity parameter is required when entityId is provided');
    }

    return this.fileRepository.findWithFilters(filters);
  }
}
