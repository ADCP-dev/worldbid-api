import { AuthGuard } from '@nestjs/passport';

// JWT Only Authentication
export class JwtAuthGuard extends AuthGuard('jwt') {}

// API Key Only Authentication
export class ApiKeyAuthGuard extends AuthGuard('api-key') {}

// Flexible Authentication (JWT OR API Key)
export class FlexibleAuthGuard extends AuthGuard(['jwt', 'api-key']) {}

// Optional Authentication (JWT OR API Key OR Anonymous)
export class OptionalAuthGuard extends AuthGuard([
  'jwt',
  'api-key',
  'anonymous',
]) {
  handleRequest(err: any, user: any) {
    // Don't throw error if no user (allows anonymous access)
    return user || null;
  }
}
