import { Expose, Type } from 'class-transformer';
import { User } from '@users/domain/user';

export class Session {
  @Expose()
  id: number | string;

  @Type(() => User)
  @Expose()
  user: User;

  @Expose()
  hash: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  deletedAt: Date;
}
