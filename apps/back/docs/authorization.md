# Authorization System Guide

This guide explains the authorization system used in the Foundation NestJS boilerplate, which implements a hybrid Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) approach.

## Overview

The authorization system combines two complementary approaches:

1. **Role-Based Access Control (RBAC)**: Users are assigned roles (e.g., admin, user), and roles determine what actions users can perform. This is the simpler approach and can be used when you don't need fine-grained control.

2. **Permission-Based Access Control**: For more fine-grained control, specific permissions can be assigned to roles. Permissions are resource-specific and can include ownership checks (ABAC).

## Key Components

### 1. Roles

Roles are defined in `src/roles/roles.enum.ts`:

```typescript
export enum RoleEnum {
  'admin' = 1,
  'user' = 2,
}
```

### 2. Permissions

Permissions are defined in `src/permissions/permissions.enum.ts` and use a resource-specific approach:

```typescript
export enum PermissionEnum {
  // Resource-specific permissions
  'manage:users' = 'manage:users',
  'manage:users:own' = 'manage:users:own',
  'manage:roles' = 'manage:roles',
  
  'view:reports' = 'view:reports',
  'view:analytics' = 'view:analytics',
  
  'create:content' = 'create:content',
  'edit:content' = 'edit:content',
  'edit:content:own' = 'edit:content:own',
  'delete:content' = 'delete:content',
  'delete:content:own' = 'delete:content:own',
  'publish:content' = 'publish:content',
  'publish:content:own' = 'publish:content:own',
  'approve:content' = 'approve:content',
  
  'access:admin' = 'access:admin',
  'access:api' = 'access:api',
}
```

Permission naming convention:
- `action:resource` - Can perform action on any instance of the resource
- `action:resource:own` - Can only perform action on resources owned by the user

### 3. Role-Permission Mapping

Roles are mapped to permissions in the database through a many-to-many relationship. This is seeded by the `PermissionSeedService`.

Default mappings:
- **Admin**: Has all permissions
- **User**: Has `read:any` and all `:own` permissions

## JWT Authorization Flow

### JWT Payload Structure

The JWT token contains the user's authorization information in a flat, easily accessible structure:

```json
{
  "id": 1,
  "sessionId": 54,
  "role": {
    "id": 1,
    "name": "Admin",
    "permissions": [
      "manage:users",
      "manage:users:own",
      "manage:roles",
      "view:reports",
      "view:analytics",
      "create:content",
      "edit:content",
      "edit:content:own",
      "delete:content",
      "delete:content:own",
      "publish:content",
      "publish:content:own",
      "approve:content",
      "access:admin",
      "access:api"
    ],
    "__entity": "RoleEntity"
  },
  "iat": 1750772452,
  "exp": 1750773352
}
```

Key features of this structure:
- User ID and session information for identity
- Role information including ID and name
- Flattened permissions array for efficient permission checks
- Standard JWT claims (iat, exp) for token validation

## Database Structure

The system uses the following database tables:
- `role` - Stores roles
- `permission` - Stores permissions
- `role_permissions` - Junction table for the many-to-many relationship

## Using the Authorization System

You have two ways to protect your routes: using roles (simpler) or permissions (more granular).

### 1. Role-Based Protection

To protect a route based on role (bypassing the permission system):

```typescript
import { Controller, Get } from '@nestjs/common';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';

@Controller('admin')
export class AdminController {
  @Get()
  @Roles(RoleEnum.admin)  // Only admin role can access
  getAdminPanel() {
    return { message: 'Admin panel' };
  }
}
```

This approach is simpler but less flexible. If a user has the specified role, they can access the route regardless of specific permissions.

### 2. Permission-Based Protection

To protect a route based on permissions:

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import { RequirePermissions } from '../permissions/permissions.decorator';
import { PermissionEnum } from '../permissions/permissions.enum';

@Controller('posts')
export class PostsController {
  @Get()
  @RequirePermissions(PermissionEnum['view:content'])  // Anyone with view:content permission
  findAll() {
    return this.postsService.findAll();
  }
  
  @Post()
  @RequirePermissions(PermissionEnum['create:content'])  // Only users with create:content permission
  create(@Body() createPostDto: CreatePostDto, @Request() req) {
    // Associate post with current user
    createPostDto.userId = req.user.id;
    return this.postsService.create(createPostDto);
  }
}
```

### 3. Entity Ownership Protection

For routes that require entity ownership verification:

```typescript
import { Controller, Get, Param, Request } from '@nestjs/common';
import { RequirePermissions } from '../permissions/permissions.decorator';
import { PermissionEnum } from '../permissions/permissions.enum';

@Controller('documents')
export class DocumentsController {
  @Get(':id')
  @RequirePermissions(PermissionEnum['view:content:own'])  // Can only access if user owns the document
  async findOne(@Param('id') id: string, @Request() req) {
    // Fetch the document
    const document = await this.documentsService.findOne(id);
    
    // IMPORTANT: Attach the entity to the request for ownership checking
    req.entity = document;
    
    return document;
  }
}
```

### 4. How Ownership Is Determined

When using `:own` permissions, the system automatically checks if the user owns the entity by looking for common ownership fields:

```typescript
// From permissions.guard.ts
const ownerFields = ['userId', 'ownerId', 'createdBy', 'authorId'];

for (const field of ownerFields) {
  if (entity[field] && user.id && String(entity[field]) === String(user.id)) {
    return true;
  }
}
```

This means your entity should have one of these fields containing the user ID to make ownership checks work properly.

### 4. Using Entity Preparation Middleware

For cleaner code, you can use middleware to load entities:

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class EntityLoaderMiddleware implements NestMiddleware {
  constructor(private readonly service: YourEntityService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (req.params.id) {
      const entity = await this.service.findOne(req.params.id);
      req.entity = entity;
    }
    next();
  }
}

// In your module:
export class YourModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(EntityLoaderMiddleware)
      .forRoutes({ path: 'your-entity/:id*', method: RequestMethod.ALL });
  }
}
```

### 5. Custom Ownership Checking

For complex ownership relationships:

```typescript
import { OwnershipChecker } from '../permissions/ownership.checker';

// In your guard or service:
const isOwner = OwnershipChecker.check(
  user,
  entity,
  (user, entity) => {
    // Custom ownership logic
    return entity.teamId === user.teamId || entity.createdBy === user.id;
  }
);
```

## Best Practices

1. **Be specific with permissions**: Use specific permissions rather than generic ones when possible.

2. **Attach entities to request**: Always attach the entity to `req.entity` for routes with `:own` permissions.

3. **Use middleware**: Create middleware to load entities automatically for cleaner controller code.

4. **Consider performance**: For better performance, consider caching user permissions after fetching.

5. **Default to deny**: Always explicitly set permissions on routes instead of relying on defaults.

6. **Hierarchical permissions**: Consider implementing hierarchical permissions for more complex systems.

## Debugging

If you're having issues with the authorization system:

1. Check that the user has the correct role.
2. Verify that the role has the necessary permissions.
3. For `:own` permissions, ensure the entity is properly attached to the request.
4. Confirm that the ownership check correctly determines the relationship.

## Extending the System

The system can be extended in several ways:

1. **Additional roles**: Add new roles to the `RoleEnum`.
2. **Custom permissions**: Add domain-specific permissions to `PermissionEnum`.
3. **Resource-specific permissions**: Implement more specific permissions like `read:articles`.
4. **Permission inheritance**: Implement a hierarchical permission system where some permissions imply others.

---

## Recent Updates (2025-06-25)

The authorization layer was refactored to be leaner, more generic and easier to maintain:

### 1  Dynamic ownership checks
* New `OwnershipService` resolves the entity class from `DataSource` metadata at runtime and fetches **only the owner column** (no full entity load).
* No more hard-coded `ENTITY_MAP`; the service detects the entity automatically and guesses the owner column from a small common list (`ownerId`, `userId`, `createdBy`).

```ts
const isOwner = await ownershipService.isOwner(user, 'country', countryId);
```

### 2  `PermissionsGuard` improvements
* Made `canActivate` async and delegates `:own` checks to `OwnershipService`.
* Automatically extracts `entityName` and `entityId` from the request path (`:id`).

### 3  Modularisation
* Added `PermissionsModule` which provides `OwnershipService` and exports it so it can be injected anywhere.
* Feature modules (e.g. `CountriesModule`) now import `PermissionsModule`.

### 4  Usage example in a controller
```ts
@Get(':id')
@RequirePermissions(PermissionEnum['view:country:own'])
async findById(@Param('id') id: string) {
  return this.countriesService.findById(id);
}
```

### 5  Performance
* Only a single scalar value (owner id) is selected, reducing DB IO.

### 6  Migration notes
* Remove any custom `OwnershipChecker` mappings – the new service is fully dynamic.
* Ensure owner columns follow one of the common names or extend the list in `OwnershipService`.

---

The system can be extended in several ways:

1. **Additional roles**: Add new roles to the `RoleEnum`.
2. **Custom permissions**: Add domain-specific permissions to `PermissionEnum`.
3. **Resource-specific permissions**: Implement more specific permissions like `read:articles`.
4. **Permission inheritance**: Implement a hierarchical permission system where some permissions imply others.
