# NestJS Best Practices — Reference

## Architecture (CRITICAL)

| Rule | Pattern |
|------|---------|
| Feature modules | One module per domain (`users/`, `orders/`) — NOT by layer |
| Single responsibility | One concern per service — NO god services |
| Circular deps | Extract shared module or use events — NO `forwardRef` hack |
| Module sharing | Export from module, import module — NOT provide in multiple places |
| Repository pattern | Custom repos encapsulate queries — services stay business logic |

## Dependency Injection (CRITICAL)

- **Constructor injection** only — NO `ModuleRef.get()` or property injection
- **Interface tokens** — use `Symbol()` or abstract class (TS interfaces erased at runtime)
- **Scopes**: DEFAULT (singleton) > REQUEST > TRANSIENT — most things singleton
- **LSP**: Mock services must honor same contract as real impls

## Error Handling (HIGH)

```typescript
// Throw from services — controllers stay thin
throw new NotFoundException(`User #${id} not found`);
throw new ConflictException('Email already registered');

// Global exception filter catches everything
@Catch()
export class AllExceptionsFilter implements ExceptionFilter { ... }
```

## Security (HIGH)

- JWT: short-lived (15m) + refresh tokens — store secrets in env, NO hardcode
- Rate limit: `@nestjs/throttler` — stricter on auth endpoints
- Validate ALL input: DTOs + class-validator + global ValidationPipe
- Guards for auth/roles — NO manual checks in handlers
- Sanitize HTML output (`sanitize-html`) on user-generated content

## Performance (HIGH)

- Select only needed columns — avoid `find()` when you need 1 field
- Use `relations` or QueryBuilder joins — avoid N+1 (lazy loading in loops)
- Cache expensive queries: `@nestjs/cache-manager` with Redis
- Paginate all list endpoints — NO unlimited `.find()`

## Testing (MEDIUM-HIGH)

- Unit: `Test.createTestingModule` with mocked repos/services
- E2E: Supertest with `Test.createTestingModule({ imports: [AppModule] })`
- Mock ALL external services — NO real DB/API calls in tests

## API Design (MEDIUM)

- DTOs with `@Exclude()` / `@Expose()` for response serialization
- Interceptors for cross-cutting (logging, timing, response wrapping)
- Pipes for input transformation (`ParseIntPipe`, `ParseUUIDPipe`)
- Versioning: `@Version('1')` for breaking changes

## Queues (MEDIUM)

- Use `@nestjs/bullmq` for background jobs (email, reports, processing)
- Always set `attempts` + `backoff` for retry
- Graceful shutdown: close queue connections via lifecycle hooks
