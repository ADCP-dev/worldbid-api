import { ApiKey } from '../../domain/api-key';
import { NullableType } from '../../../utils/types/nullable.type';

export abstract class ApiKeyRepository {
  abstract create(
    data: Omit<ApiKey, 'id' | 'createdAt' | 'updatedAt' | 'user'>,
  ): Promise<ApiKey>;

  abstract findByKey(key: string): Promise<NullableType<ApiKey>>;

  abstract findByUserId(userId: number): Promise<NullableType<ApiKey>>;

  abstract update(id: number, payload: Partial<ApiKey>): Promise<ApiKey | null>;

  abstract remove(id: number): Promise<void>;
}
