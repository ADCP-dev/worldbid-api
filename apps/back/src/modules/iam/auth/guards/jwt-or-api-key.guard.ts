import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtOrApiKeyGuard extends AuthGuard(['jwt', 'api-key']) {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // If there's an error or no user, throw an unauthorized exception
    if (err || !user) {
      throw err || new Error('Unauthorized');
    }
    return user;
  }
}
