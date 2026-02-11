import { User } from '../../users/domain/user';

export class ApiKey {
  id: number;
  key: string;
  user?: User;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}
