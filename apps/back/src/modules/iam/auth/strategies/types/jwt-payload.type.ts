import { Session } from '@iam/session/domain/session';
import { User } from '@users/domain/user';

export type JwtPayloadType = Pick<User, 'id' | 'role'> & {
  sessionId: Session['id'];
  language: string;
  iat: number;
  exp: number;
};
