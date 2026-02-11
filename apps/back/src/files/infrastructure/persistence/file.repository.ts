import { NullableType } from '../../../utils/types/nullable.type';
import { FileType } from '../../domain/file';
import { FileFilterDto } from '../../dto/file-filter.dto';

export abstract class FileRepository {
  abstract create(data: Omit<FileType, 'id'>): Promise<FileType>;

  abstract findById(id: FileType['id']): Promise<NullableType<FileType>>;

  abstract findByIds(ids: FileType['id'][]): Promise<FileType[]>;

  abstract findWithFilters(filters: FileFilterDto): Promise<FileType[]>;

  abstract update(
    id: FileType['id'],
    data: Partial<Omit<FileType, 'id'>>,
  ): Promise<FileType>;

  abstract delete(id: FileType['id']): Promise<void>;
}
