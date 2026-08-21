---
doc: agent-native/07-mandatory-guards
title: "Guards Obligatorios en Spec Engine"
status: draft
created: 2026-08-19
priority: P1
---

# PRD 07 — Guards Obligatorios en Spec Engine

## Objetivo

Hacer que el spec engine rechace specs que no declaren permisos para cada operación. Si un recurso no tiene `permissions` declarado, el spec no carga. Esto elimina el riesgo de "olvidar un guard" — el problema de seguridad que RLS resolvería pero sin el infierno de SQL anidado.

## Problema actual

Hoy, si un recurso spec-driven no declara `permissions`:

```yaml
resources:
  - name: invoice
    table: ext_billing_invoice
    fields:
      - name: amount
        type: decimal
        required: true
    # SIN permissions → cualquiera puede acceder?
```

El `ControllerFactory` aplica un guard por defecto que podría ser `jwt` (autenticado) pero sin checkeo de roles. Esto es un hole de seguridad: cualquier usuario autenticado puede ver facturas de otros.

El problema no es técnico, es de **enforcement**. No hay nada que fuerce al desarrollador (humano o agente) a declarar permisos. RLS resolvería esto a nivel DB, pero como vimos, RLS es un infierno para permisos complejos. La solución es forzar la declaración en el spec.

## Diseño

### Regla: permissions obligatorio

El `SpecValidator` (en `spec-validator.ts`) rechaza cualquier recurso que no tenga `permissions` declarado:

```typescript
// spec-validator.ts (extender)
export class SpecValidator {
  validateResource(resource: ResourceSpec, extension: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // ─── NUEVO: permissions obligatorio ───
    if (!resource.permissions) {
      errors.push({
        code: 'MISSING_PERMISSIONS',
        message: `Resource "${resource.name}" in extension "${extension}" must declare permissions. Every resource must explicitly define who can list, read, create, update, and delete.`,
        specFile: this.currentSpecFile,
        resource: resource.name,
        section: 'permissions',
        fix: {
          type: 'spec_fix',
          description: `Add a permissions block to resource "${resource.name}". Example:\n\npermissions:\n  list: [admin]\n  read: [admin, user]\n  create: [admin]\n  update: [admin]\n  delete: [admin]\n\nOr mark as public if intended:\n\npermissions:\n  list: [public]\n  read: [public]`,
          targetSpec: this.currentSpecFile,
        },
      });
    }

    // ─── NUEVO: cada operación debe estar declarada ───
    if (resource.permissions) {
      const requiredOps: PermissionAction[] = ['list', 'read', 'create', 'update', 'delete'];

      for (const op of requiredOps) {
        if (!resource.permissions[op]) {
          errors.push({
            code: 'MISSING_PERMISSION_ACTION',
            message: `Resource "${resource.name}" is missing permissions.${op}. Every operation must be explicitly declared, even if it's an empty array (no one can access) or [public].`,
            specFile: this.currentSpecFile,
            resource: resource.name,
            section: `permissions.${op}`,
            fix: {
              type: 'spec_fix',
              description: `Add permissions.${op} to resource "${resource.name}". Use [admin] for admin-only, [admin, user] for broader access, [] for no access, or [public] for unauthenticated.`,
              targetSpec: this.currentSpecFile,
            },
          });
        }
      }
    }

    // ... validaciones existentes ...
    return errors;
  }
}
```

### Nuevo rol: `public`

Para recursos que deben ser accesibles sin autenticación (landing pages, blog posts públicos, etc.), se añade `public` como rol especial:

```typescript
export type BuiltinRole = 'admin' | 'user' | 'public';
```

```yaml
resources:
  - name: blog-post
    table: ext_cms_blog_post
    fields:
      - name: title
        type: string
        required: true
      - name: content
        type: text
        required: true
      - name: published
        type: boolean
        default: false
    permissions:
      auth: [public]           # sin autenticación para list/read
      list: [public]           # cualquiera puede ver posts publicados
      read: [public]
      create: [admin]          # solo admin crea
      update: [admin]
      delete: [admin]
      rowLevel:
        public:
          filter: 'published == true'   # público solo ve publicados
```

Nota: cuando `auth: [public]`, las operaciones `create`, `update`, `delete` con roles `[admin]` requieren JWT implícitamente (no puede ser admin sin estar autenticado). El `buildGuard` maneja esto: si `auth` es `[public]` pero la operación tiene roles no-public, usa JWT guard para esa operación específica.

Esto significa que `auth` puede ser por-operación en la práctica:
- `list` y `read` con `[public]` → PublicGuard
- `create` con `[admin]` → JWT + RolesGuard(admin)

El `buildGuard` recibe el `action` específico, así que puede decidir qué guard aplicar por operación. Si la operación tiene roles que no incluyen `public`, usa JWT guard aunque `auth` diga `[public]`.

### Spec: declaración de auth

Añadir campo `auth` al `PermissionSpec` para que cada recurso pueda declarar qué métodos de autenticación acepta:

```typescript
export type AuthMethod = 'jwt' | 'api-key' | 'public';

export interface PermissionSpec {
  list?: PermissionRole[];
  read?: PermissionRole[];
  create?: PermissionRole[];
  update?: PermissionRole[];
  delete?: PermissionRole[];
  fields?: Record<string, FieldPermissionSpec>;
  rowLevel?: Record<string, RowLevelSpec>;
  // ─── NUEVO ───
  auth?: AuthMethod[];  // métodos de autenticación aceptados. Default: ['jwt']
}
```

En el spec YAML:

```yaml
permissions:
  auth: [jwt, api-key]     # acepta JWT o API key (cualquiera pasa)
  list: [admin, user, manager]
  read: [admin, user, manager]
  create: [admin, manager]
  update: [admin, user, manager]
  delete: [admin]
```

Si `auth` no se declara, default es `['jwt']` (comportamiento actual del ControllerFactory).

Si `auth: [public]`, el endpoint no requiere autenticación (PublicGuard).

Si `auth: []`, nadie puede acceder (DenyAllGuard).

### ControllerFactory: aplicar guards

El `buildGuard` construye el stack de guards NestJS según `auth` declarado:

```typescript
// controller-factory.ts (extender)
function buildGuard(permissions: PermissionSpec, action: PermissionAction): MethodDecorator[] {
  const authMethods = permissions.auth || ['jwt'];  // default: jwt
  const roles = permissions[action] || [];

  // ─── Deny all: sin roles y sin public ───
  if (roles.length === 0 && !authMethods.includes('public')) {
    return [UseGuards(DenyAllGuard)];
  }

  // ─── Determinar si esta operación específica es pública ───
  // Si auth incluye 'public' Y los roles de esta operación incluyen 'public',
  // entonces la operación es pública.
  // Si auth incluye 'public' pero los roles NO incluyen 'public' (ej: create: [admin]),
  // la operación requiere JWT (no puedes ser admin sin estar autenticado).
  const opIsPublic = authMethods.includes('public') && roles.includes('public');

  // ─── Public operation ───
  if (opIsPublic) {
    const guards: MethodDecorator[] = [UseGuards(PublicGuard)];
    // Si hay rowLevel para 'public', RolesGuard lo aplica
    if (permissions.rowLevel?.public) {
      guards.push(UseGuards(RolesGuard), Roles('public'));
    }
    return guards;
  }

  // ─── Auth required ───
  const guards: MethodDecorator[] = [];

  // Elegir auth guard según métodos declarados (excluyendo 'public' que ya se manejó)
  const authOnly = authMethods.filter(m => m !== 'public');

  if (authOnly.length === 0) {
    // auth: [public] pero operación no es pública → usar JWT como fallback
    guards.push(UseGuards(AuthGuard('jwt')));
  } else if (authOnly.length === 1) {
    if (authOnly[0] === 'jwt') {
      guards.push(UseGuards(AuthGuard('jwt')));
    } else if (authOnly[0] === 'api-key') {
      guards.push(UseGuards(ApiKeyGuard));
    }
  } else {
    // Múltiples métodos: JWT o API key
    guards.push(UseGuards(JwtOrApiKeyGuard));
  }

  // RolesGuard después del auth guard
  // Filtrar 'public' de los roles (no es un rol real para RolesGuard)
  const effectiveRoles = roles.filter(r => r !== 'public');
  if (effectiveRoles.length > 0) {
    guards.push(UseGuards(RolesGuard), Roles(...effectiveRoles));
  }

  return guards;
}
```

Nota sobre el ThrottlerGuard: `UserOrIpThrottlerGuard` ya está registrado como `APP_GUARD` global en `app.module.ts`. No se añade por route. El MCP refleja su presencia en `guard.rateLimit` pero el `buildGuard` no lo incluye en el stack porque ya es global.

### DenyAllGuard

Para operaciones con `[]` (nadie puede acceder):

```typescript
// core/spec-engine/deny-all.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class DenyAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const resourceName = Reflect.getMetadata('spec:resource', handler) || 'unknown';
    const operation = Reflect.getMetadata('spec:operation', handler) || 'unknown';
    throw new ForbiddenException(
      `Operation "${operation}" on resource "${resourceName}" is disabled (empty permissions array in spec).`
    );
  }
}
```

Útil para operaciones que quieres deshabilitar temporalmente: `delete: []` significa que nadie puede borrar.

### PublicGuard

Para operaciones `public` que aún necesitan rowLevel filtering:

```typescript
// core/spec-engine/public.guard.ts
@Injectable()
export class PublicGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    // Usuario ficticio para compatibilidad con rowLevel evaluator existente.
    // id: null (no un usuario real con id=0 que podría resolver a algo).
    // roles: ['public'] para que el evaluator lo reconozca.
    request.user = { id: null, roles: ['public'] };
    request.isPublic = true;
    return true;
  }
}
```

El rowLevel evaluator (en controller-factory o un interceptor) debe manejar el caso `public`:

```typescript
function evaluateRowLevel(filter: string, entity: Record<string, unknown>, request: Request): boolean {
  if (request.isPublic) {
    // Para public, ${user.id} no existe. El filter debe usar campos de la entity,
    // no del usuario. Ej: 'published == true'
    return evalFilter(filter, { ...entity }, null);
  }
  return evalFilter(filter, entity, request.user);
}
```

Si un spec declara `rowLevel.public.filter: 'assigneeId == ${user.id}'`, el validator debe rechazarlo porque `public` no tiene `user.id`:

```typescript
// spec-validator.ts (añadir)
if (resource.permissions?.rowLevel?.public) {
  const filter = resource.permissions.rowLevel.public.filter;
  if (filter.includes('${user.')) {
    errors.push({
      code: 'PUBLIC_ROWLEVEL_REQUIRES_USER',
      message: `rowLevel for 'public' role cannot reference \${user.*} — public users have no user context. Use entity fields only (ej: 'published == true').`,
      section: 'permissions.rowLevel.public',
    });
  }
}
```

### Validación de actions

Las custom actions tienen su propio campo `auth`. El validator debe verificar que también esté declarado:

```typescript
// spec-validator.ts (añadir)
if (resource.actions) {
  for (const action of resource.actions) {
    if (!action.auth) {
      errors.push({
        code: 'MISSING_ACTION_AUTH',
        message: `Action "${action.name}" on resource "${resource.name}" must declare auth. Use [admin], [admin, user], [public], or [].`,
        section: `actions.${action.name}.auth`,
      });
    }
  }
}
```

Si `action.auth` no se declara, se aplica el default: los mismos permisos que `create` del recurso. Pero el validator debe forzar la declaración explícita.

### Migración de specs existentes

Las extensions existentes (CRM, Tasks, CMS, Stripe) ya tienen permissions declarados. Pero si alguna operación falta, el spec no cargará después de este cambio.

Para migrar:

1. Ejecutar `pnpm spec:validate --strict` para detectar resources sin permissions completos
2. Para cada resource faltante, añadir permissions
3. Si no está claro qué permisos poner, usar `[]` (deny all) y revisar caso por caso

```bash
# Comando para detectar specs sin permissions completos
pnpm spec:validate --strict --report=json > spec-validation-report.json
```

### Report de validación

```json
{
  "valid": false,
  "errors": [
    {
      "code": "MISSING_PERMISSIONS",
      "extension": "stripe",
      "resource": "invoice",
      "specFile": "extensions/stripe/invoice.spec.yaml",
      "section": "permissions",
      "fix": {
        "type": "spec_fix",
        "description": "Add a permissions block to resource \"invoice\"...",
        "targetSpec": "extensions/stripe/invoice.spec.yaml"
      }
    },
    {
      "code": "MISSING_PERMISSION_ACTION",
      "extension": "tasks",
      "resource": "task",
      "specFile": "extensions/tasks/task.spec.yaml",
      "section": "permissions.delete",
      "fix": {
        "type": "spec_fix",
        "description": "Add permissions.delete to resource \"task\"..."
      }
    }
  ]
}
```

### Integración con MCP (PRD 02)

El MCP introspection server ya lista rutas con guards. Con este PRD, `foundation.list_routes` siempre muestra guards válidos — no hay rutas sin guard.

### Integración con errors (PRD 01)

Si un spec se carga sin permissions (por bug en validator), el error se reporta como `spec_invalid` con `suggestedFix` apuntando al spec file.

## Implementación

### Fase 1: Validator + roles (opt-in)

1. Añadir `public` a `BuiltinRole`
2. Extender `SpecValidator` con checks de permissions obligatorios
3. Implementar `DenyAllGuard` y `PublicGuard`
4. Extender `ControllerFactory.buildGuard()` con nuevos guards
5. `--strict` es opt-in: `pnpm spec:validate --strict` reporta pero NO bloquea

### Timeline de activación (3 fases)

| Fase | Duración | Comportamiento | Objetivo |
|------|----------|----------------|----------|
| **Opt-in** | 2 semanas | `--strict` reporta errores, no bloquea. Los specs existentes se corrigen gradualmente. | Detectar todos los specs faltantes sin presión |
| **Warning** | 1 semana | El spec engine boot loguea warnings por specs sin permissions completos. Carga pero avisa. | Última chance de corregir antes del enforcement |
| **Enforced** | Permanente | El spec engine RECHAZA specs sin permissions completos. No carga. CI falla. | Garantía de seguridad total |

### Compatibilidad del PublicGuard con código existente

El `rowLevel evaluator` actual en `controller-factory.ts` espera `request.user` como objeto. Cambiar a `null` rompe el código existente. Solución: el PublicGuard asigna un usuario ficticio pero con ID nulo y flag `isPublic`:

```typescript
// core/spec-engine/public.guard.ts
@Injectable()
export class PublicGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    // Usuario ficticio para compatibilidad con rowLevel evaluator existente.
    // id: null previene que refs a user resuelvan a un usuario real.
    // roles: ['public'] para que el evaluator lo reconozca.
    // isPublic: flag para lógica que necesita distinguir public de auth.
    request.user = { id: null, roles: ['public'] };
    request.isPublic = true;
    return true;
  }
}
```

El `rowLevel evaluator` existente ya maneja `${user.id}`. Si `user.id` es `null`, la condición `assigneeId == null` se evalúa contra el campo de la entity, no contra un usuario real. El validator (PRD 07) ya rechaza `rowLevel.public` que referencia `${user.*}`.

### Fase 2: Migración de existentes

1. Ejecutar `pnpm spec:validate --strict` en todas las extensions
2. Corregir specs que no cumplan (añadir permissions faltantes)
3. Testear que las extensions siguen funcionando
4. Activar fase Warning (log warnings en boot)

### Fase 3: Enforced + CI

1. Activar fase Enforced (rechazar specs inválidos en boot)
2. Añadir `pnpm spec:validate --strict` como gate de CI
3. Commits que rompen validación son rechazados

## Criterios de aceptación

1. Un recurso sin `permissions` en spec YAML es rechazado por el validator
2. Un recurso con `permissions` pero sin una de las 5 operaciones es rechazado
3. `permissions: { auth: [public], list: [public], ... }` permite acceso sin JWT para list/read
4. `permissions: { auth: [public], list: [public], create: [admin], ... }` usa PublicGuard para list y JWT+RolesGuard(admin) para create
5. `permissions: { auth: [jwt, api-key], ... }` usa JwtOrApiKeyGuard (cualquiera pasa)
6. `permissions: { auth: [api-key], ... }` usa ApiKeyGuard exclusivamente
7. `permissions: { delete: [], ... }` bloquea delete para todos (DenyAllGuard con ForbiddenException)
8. El validator sugiere el fix exacto (añadir el bloque que falta)
9. Extensions existentes migradas y funcionando
10. `pnpm spec:validate --strict` pasa en CI
11. `foundation.list_routes` (MCP) muestra guards con `auth: string[]`, `roles: string[]`, `rowLevel`, `rateLimit`
12. El `buildGuard` maneja correctamente el caso `auth: [public]` con operaciones no-públicas (usa JWT fallback)

## Dependencias

- Sin dependencias externas
- Usa SpecValidator (ya existe)
- Usa ControllerFactory (ya existe)

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Extensions existentes rompen | Migrar antes de activar strict mode; `--strict` es opt-in inicialmente |
| `public` rol filtra datos sensibles | PublicGuard aplica rowLevel para public; campos sensibles siempre field-level |
| DenyAllGuard confunde al agente | Error 403 con mensaje claro: "This operation is disabled (empty permissions array)" |