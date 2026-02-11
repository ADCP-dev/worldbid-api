import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContext } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard extends AuthGuard('api-key') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
