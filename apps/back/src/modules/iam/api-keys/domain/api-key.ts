import { Expose, Type } from 'class-transformer';
import { User } from '@users/domain/user';

export class ApiKey {
  @Expose()
  id: number;

  @Expose()
  key: string;

  @Type(() => User)
  @Expose()
  user?: User;

  @Expose()
  userId: number;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
