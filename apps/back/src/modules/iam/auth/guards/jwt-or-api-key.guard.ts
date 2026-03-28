import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtOrApiKeyGuard extends AuthGuard(['jwt', 'api-key']) {
  handleRequest(err: any, user: any) {
    // If there's an error or no user, throw an unauthorized exception
    if (err || !user) {
      throw err || new Error('Unauthorized');
    }
    return user;
  }
}
