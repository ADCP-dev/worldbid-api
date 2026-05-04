import { Injectable } from '@nestjs/common';

import { FileRepository } from '@storage/files/infrastructure/file.repository';
import { FileType } from '@storage/files/domain/file';
import { NullableType } from '@infra/utils/types/nullable.type';
import { FileFilterDto } from '@storage/files/dto/file-filter.dto';

@Injectable()
export class FilesService {
  constructor(private readonly fileRepository: FileRepository) {}

  findById(id: FileType['id']): Promise<NullableType<FileType>> {
    return this.fileRepository.findById(id);
  }

  findByIds(ids: FileType['id'][]): Promise<FileType[]> {
    return this.fileRepository.findByIds(ids);
  }

  async findWithFilters(filters: FileFilterDto): Promise<{ data: FileType[]; total: number }> {
    // Validate that if entityId is provided, entityName must also be provided
    if (filters.entityId !== undefined && filters.entityName === undefined) {
      throw new Error(
        'EntityName parameter is required when entityId is provided',
      );
    }

    return this.fileRepository.findWithFilters(filters);
  }

  update(
    id: FileType['id'],
    data: Partial<Omit<FileType, 'id'>>,
  ): Promise<FileType> {
    return this.fileRepository.update(id, data);
  }

  /**
   * Deletes the file record from the database.
   * Note: this only removes the DB record — physical file cleanup is handled
   * by the driver-specific subscribers (GlobalFileCleanupSubscriber).
   */
  delete(id: FileType['id']): Promise<void> {
    return this.fileRepository.delete(id);
  }
}
