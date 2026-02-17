# 🔐 NestJS Authentication System Guide

A comprehensive guide to the improved authentication system with clean decorators and type safety.

## 📋 Table of Contents

- [Quick Reference](#-quick-reference)
- [Authentication Decorators](#-authentication-decorators)
- [User Decorators](#-user-decorators)
- [Usage Examples](#-usage-examples)
- [Migration Guide](#-migration-guide)
- [Best Practices](#-best-practices)

## 🎯 Quick Reference

| Decorator         | Authentication Required        | Headers                         | Use Case                    |
| ----------------- | ------------------------------ | ------------------------------- | --------------------------- |
| `@JwtAuth()`      | JWT Token                      | `Authorization: Bearer <token>` | User-specific actions       |
| `@ApiKeyAuth()`   | API Key                        | `X-API-Key: <key>`              | API integrations            |
| `@FlexibleAuth()` | JWT **OR** API Key             | Either header                   | Flexible access             |
| `@OptionalAuth()` | JWT **OR** API Key **OR** None | Either or none                  | Public with personalization |
| `@AdminAuth()`    | JWT + Admin Role               | `Authorization: Bearer <token>` | Admin-only actions          |

## 🔑 Authentication Decorators

### `@JwtAuth()`

**JWT Authentication Only**

- Requires valid JWT token in Authorization header
- Perfect for user-specific actions like creating, updating, deleting
- Automatically adds Swagger `@ApiBearerAuth()` documentation

```typescript
@Post('create')
@JwtAuth()
async createTemplate(@RequiredUser() user: AuthenticatedUser) {
  // User is guaranteed to be authenticated via JWT
}
```

### `@ApiKeyAuth()`

**API Key Authentication Only**

- Requires valid API key in X-API-Key header
- Ideal for API integrations, webhooks, third-party access
- Automatically adds Swagger `@ApiSecurity('api-key')` documentation

```typescript
@Get('data')
@ApiKeyAuth()
async getTemplateData(@UserId() userId: number) {
  // User authenticated via API key
}
```

### `@FlexibleAuth()`

**JWT OR API Key Authentication**

- Accepts either JWT token OR API key
- Best for general endpoints that need flexibility
- Adds both JWT and API key Swagger documentation

```typescript
@Get('templates')
@FlexibleAuth()
async getTemplates(@RequiredUser() user: AuthenticatedUser) {
  // Works with either JWT: Authorization: Bearer <token>
  // Or API Key: X-API-Key: <key>
}
```

### `@OptionalAuth()`

**Optional Authentication**

- User can be authenticated (JWT/API Key) or anonymous
- Perfect for public content with personalization
- User might be `null` - handle accordingly

```typescript
@Get('featured')
@OptionalAuth()
async getFeatured(@CurrentUser() user: AuthenticatedUser | null) {
  const isPersonalized = user !== null;
  // Show personalized content if authenticated
  // Show public content if anonymous
}
```

### `@AdminAuth()`

**Admin-Only Authentication**

- Requires JWT token with admin role
- For administrative actions only
- Can be extended with role-based guards

```typescript
@Delete('admin/cleanup')
@AdminAuth()
async adminCleanup(@RequiredUser() admin: AuthenticatedUser) {
  // Only admin users can access this
}
```

## 👤 User Decorators

### `@RequiredUser()`

**Type-Safe Required User**

- Returns `AuthenticatedUser` type
- User is guaranteed to exist (throws error if not)
- Use with authentication-required decorators

```typescript
@FlexibleAuth()
async endpoint(@RequiredUser() user: AuthenticatedUser) {
  // user.id, user.email, user.role are guaranteed to exist
}
```

### `@CurrentUser()`

**Optional User**

- Returns `AuthenticatedUser | null`
- User might be null (for optional authentication)
- Use with `@OptionalAuth()`

```typescript
@OptionalAuth()
async endpoint(@CurrentUser() user: AuthenticatedUser | null) {
  if (user) {
    // User is authenticated
  } else {
    // Anonymous user
  }
}
```

### `@UserId()`

**User ID Only**

- Returns `number | null`
- Convenience decorator when you only need the user ID
- Lighter than getting full user object

```typescript
@ApiKeyAuth()
async endpoint(@UserId() userId: number) {
  // Just get the user ID, not the full user object
}
```

## 💡 Usage Examples

### Complete Controller Example

```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  JwtAuth,
  ApiKeyAuth,
  FlexibleAuth,
  OptionalAuth,
} from '../auth/decorators/auth.decorator';
import {
  RequiredUser,
  CurrentUser,
  UserId,
  AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';

@ApiTags('Templates')
@Controller({ path: 'templates', version: '1' })
export class TemplatesController {
  // ✅ JWT Only - User Management
  @Post()
  @JwtAuth()
  @ApiOperation({ summary: 'Create template (JWT required)' })
  async create(
    @Body() createDto: CreateTemplateDto,
    @RequiredUser() user: AuthenticatedUser,
  ) {
    return this.templatesService.create(createDto, user.id);
  }

  // ✅ API Key Only - External Integrations
  @Get('external/:id')
  @ApiKeyAuth()
  @ApiOperation({ summary: 'Get template for external API (API Key required)' })
  async getForExternal(@Param('id') id: string, @UserId() userId: number) {
    return this.templatesService.findForExternal(id, userId);
  }

  // ✅ Flexible - General Access
  @Get()
  @FlexibleAuth()
  @ApiOperation({ summary: 'List templates (JWT or API Key)' })
  async findAll(
    @Query() query: FindAllDto,
    @RequiredUser() user: AuthenticatedUser,
  ) {
    return this.templatesService.findByUser(query, user.id);
  }

  // ✅ Optional - Public with Personalization
  @Get('featured')
  @OptionalAuth()
  @ApiOperation({ summary: 'Get featured templates (optional auth)' })
  async getFeatured(
    @Query() query: QueryDto,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    const userId = user?.id || null;
    return this.templatesService.findFeatured(query, userId);
  }
}
```

## 🔄 Migration Guide

### Before (Verbose & Error-Prone)

```typescript
@ApiBearerAuth()
@ApiSecurity('api-key')
@UseGuards(JwtOrApiKeyGuard)
async endpoint(@CurrentUser() user: any) {
  // No type safety, verbose decorators
}
```

### After (Clean & Type-Safe)

```typescript
@FlexibleAuth()
async endpoint(@RequiredUser() user: AuthenticatedUser) {
  // Clean, type-safe, self-documenting
}
```

### Migration Steps

1. **Replace guard combinations** with semantic decorators
2. **Add type safety** to user parameters
3. **Update imports** to use new decorators
4. **Test thoroughly** - authentication behavior should be identical

## ✅ Best Practices

### 1. **Choose the Right Decorator**

- `@JwtAuth()` for user-specific actions (CRUD operations)
- `@ApiKeyAuth()` for external API access
- `@FlexibleAuth()` for general endpoints
- `@OptionalAuth()` for public content with personalization

### 2. **Use Type-Safe User Decorators**

```typescript
// ✅ Good - Type safe
@RequiredUser() user: AuthenticatedUser

// ❌ Avoid - No type safety
@CurrentUser() user: any
```

### 3. **Handle Optional Authentication Properly**

```typescript
@OptionalAuth()
async endpoint(@CurrentUser() user: AuthenticatedUser | null) {
  if (user) {
    // Authenticated user logic
  } else {
    // Anonymous user logic
  }
}
```

### 4. **Consistent Error Handling**

The decorators automatically handle authentication errors:

- Missing/invalid JWT → `401 Unauthorized`
- Missing/invalid API Key → `401 Unauthorized`
- User required but not authenticated → `401 Unauthorized`

### 5. **Swagger Documentation**

All decorators automatically add appropriate Swagger documentation:

- JWT endpoints show "Authorize" button
- API Key endpoints show API key input
- Flexible endpoints show both options

## 🎨 Architecture Benefits

| **Aspect**               | **Improvement**                         |
| ------------------------ | --------------------------------------- |
| **Readability**          | Single decorator vs multiple decorators |
| **Type Safety**          | `AuthenticatedUser` vs `any`            |
| **Maintainability**      | Change one decorator vs multiple places |
| **Documentation**        | Auto-generated Swagger docs             |
| **Consistency**          | Same pattern across entire app          |
| **Developer Experience** | IntelliSense and auto-completion        |

## 🚀 Advanced Usage

### Custom Authentication Decorator

```typescript
export function OwnerAuth() {
  return applyDecorators(
    FlexibleAuth(),
    // Add custom ownership validation
  );
}
```

### Role-Based Authentication

```typescript
export function RoleAuth(roles: string[]) {
  return applyDecorators(
    JwtAuth(),
    // Add role validation guard
  );
}
```

This authentication system provides a clean, type-safe, and maintainable approach to handling authentication in your NestJS application! 🎉
