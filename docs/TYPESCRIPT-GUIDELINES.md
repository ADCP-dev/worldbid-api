# TypeScript Guidelines — Foundation Mono

> Este documento establece las convenciones y reglas para escribir código TypeScript en el proyecto Foundation Mono. El objetivo es evitar errores comunes que generan las IAs al programar.

---

## 1. Imports — Path Aliases

### Backend

El proyecto usa path aliases configurados en `tsconfig.json`. **Siempre usar estos aliases** en vez de rutas relativas.

```typescript
// ❌ INCORRECTO — rutas relativas largas
import { User } from "../../../users/domain/user";
import { helper } from "./../../infra/utils/helper";

// ✅ CORRECTO — path aliases
import { User } from "@users/domain/user";
import { NullableType } from "@infra/utils/types/nullable.type";
import { AllConfigType } from "@src/config/config.type";
```

| Alias        | Destino                        | Ejemplo                              |
| ------------ | ------------------------------ | ------------------------------------ |
| `@ext/*`     | `src/extensions/*`             | `@ext/my-extension/extension.module` |
| `@iam/*`     | `src/modules/iam/*`            | `@iam/auth/auth.service`             |
| `@users/*`   | `src/modules/users/*`          | `@users/users.service`               |
| `@comms/*`   | `src/modules/communications/*` | `@comms/email/email.service`         |
| `@billing/*` | `src/modules/billing/*`        | `@billing/billing.service`           |
| `@storage/*` | `src/modules/storage/*`        | `@storage/files/files.service`       |
| `@social/*`  | `src/modules/social/*`         | `@social/social.service`             |
| `@infra/*`   | `src/infrastructure/*`         | `@infra/database/database.module`    |
| `@src/*`     | `src/*`                        | `@src/config/config.type`            |
| `@core/*`    | `src/core/*`                   | `@core/foundation.module`            |

**Razón**: Las rutas relativas largas son frágiles. La IA a menudo calcula mal la profundidad de `../` generando imports rotos.

### Frontend

**Regla: Usar siempre `@` antes que `~`**

```typescript
// ❌ INCORRECTO — usar ~ cuando se puede usar @
import { useUsers } from "~/composables/useUsers";
import DataTable from "~/components/base/DataTable.vue";

// ✅ CORRECTO — usar @ siempre
import { useUsers } from "@/composables/useUsers";
import DataTable from "@/components/base/DataTable.vue";
import { useAuthStore } from "#imports";
```

**Aliases de módulos (Nuxt Layers)**:

| Alias      | Destino                      | Ejemplo                        |
| ---------- | ---------------------------- | ------------------------------ |
| `@base`    | `apps/front/modules/base`    | `@base/auth/stores/auth.store` |
| `@cms`     | `apps/front/modules/cms`     | `@cms/pages/cms-index.vue`     |
| `@landing` | `apps/front/modules/landing` | `@landing/pages/landing.vue`   |

**Ejemplos de uso**:

```typescript
// ✅ CORRECTO — imports desde módulos
import { useAuthStore } from "@base/auth/stores/auth.store";
import DataTable from "@base/ui-app/components/data-table/DataTable.vue";

// ❌ INCORRECTO — rutas relativas largas desde módulos
import { useAuthStore } from "../../../../modules/base/auth/stores/auth.store";
```

**Razón**: Nuxt genera un `tsconfig.json` en `.nuxt/` con los aliases correctos. Usar `@` consistently evita confusión.

---

## 2. Tipos — `import type`

### Regla

Si un import **solo se usa como tipo** (type, interface, enum), usar `import type`. Si se usa como **valor** (instanciar, ejecutar), usar import normal.

```typescript
// ✅ CORRECTO — import type para solo tipos
import type { User } from "@users/domain/user";
import type { ColumnDef } from "@tanstack/vue-table";
import type { ZodSchema } from "zod";
import type { AllConfigType } from "@src/config/config.type";

// ✅ CORRECTO — import normal para valores (se usa new, o se ejecuta)
import { User } from "@users/domain/user"; // si se hace: new User()
import { Logger } from "@nestjs/common"; // se usa: new Logger()
import { toast } from "vue-sonner"; // se ejecuta: toast()
```

### Por qué

- **Tree-shaking**: TypeScript elimina imports type en compilación
- **Claridad**: Queda explícito qué es tipo y qué es valor
- **Performance**: Bundle más liviano

---

## 3. Never `any`

### La Regla

**Nunca usar `any`**. Es el mayor source de errores silenciosos en TypeScript.

```typescript
// ❌ NUNCA HACER ESTO
const data: any = fetch('/api/data')
function process(data: any) { ... }
const user: any = { name: 'John' }

// ✅ CORRECTO — tipar correctamente
interface User { id: string; name: string }
const user: User = { id: '1', name: 'John' }

// ✅ CORRECTO — unknown con type guard
function process(data: unknown): string {
  if (typeof data === 'string') {
    return data.toUpperCase()
  }
  if (typeof data === 'object' && data !== null) {
    return JSON.stringify(data)
  }
  throw new TypeError('Expected string or object')
}

// ✅ CORRECTO — usar utility types del proyecto
import { NullableType } from '@infra/utils/types/nullable.type'
const user: NullableType<User> = await findUser()
```

### Excepciones

Si realmente no podés tipar (third-party legacy, dinámico extremo), documentá por qué:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacyData: any = config.legacyField;
```

---

## 4. Null y Undefined

### Asumir Siempre

```typescript
// ❌ INCORRECTO — asumir que no es null
const name = user.name; // explota si user es null

// ✅ CORRECTO — asumir que puede ser null/undefined
const name = user?.name ?? "Anonymous";
const photoPath = user?.photo?.path ?? "/default-avatar.png";
```

### Backend — Utility Types

El proyecto tiene utility types para esto:

```typescript
import { NullableType } from '@infra/utils/types/nullable.type'   // T | null
import { MaybeType } from '@infra/utils/types/maybe.type'         // T | undefined
import { OrNeverType } from '@infra/utils/types/or-never.type'    // T | never

// Ejemplos de uso
async findById(id: string): Promise<NullableType<User>> {
  const user = await this.userRepository.findOne({ where: { id } })
  return user ?? null
}

const name: MaybeType<string> = user?.name // puede ser undefined
```

### TypeScript Config

El proyecto tiene `strictNullChecks: true` en `tsconfig.json`. Esto significa que TypeScript **exige** manejar null/undefined.

---

## 5. Variables de Entorno

### No Hardcodear

```typescript
// ❌ INCORRECTO
const API_URL = "https://api.example.com";
const STRIPE_KEY = "sk_live_123456";

// ✅ CORRECTO — Backend (configService)
const apiUrl = configService.get("apiUrl");
const stripeKey = configService.get("stripeKey", { infer: true }) as string;

// ✅ CORRECTO — Frontend (useRuntimeConfig)
const config = useRuntimeConfig();
const apiUrl = config.public.apiUrl;
```

**Regla**: URLs, tokens, API keys, secrets — todo de variables de entorno.

---

## 6. Logging

### Usar Logger del Proyecto

```typescript
// ❌ PROHIBIDO
console.log("debug message");
console.error("error message");
console.warn("warning");

// ✅ CORRECTO — Backend (NestJS Logger)
import { Logger } from "@nestjs/common";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  create(user: CreateUserDto): Promise<User> {
    this.logger.log(`Creating user with email: ${user.email}`);
    // ... lógica
    this.logger.log(`User created successfully: ${newUser.id}`);
  }

  async findById(id: string): Promise<NullableType<User>> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      this.logger.warn(`User not found: ${id}`);
      return null;
    }
    return user;
  }

  async processUser(id: string): Promise<void> {
    try {
      // ... lógica
    } catch (error) {
      this.logger.error(`Failed to process user ${id}`, error.stack);
      throw error;
    }
  }
}
```

### Niveles de Log

| Nivel      | Uso                                                            |
| ---------- | -------------------------------------------------------------- |
| `.log()`   | Info general, operations completed                             |
| `.warn()`  | Algo inesperado pero manejable (user not found, etc.)          |
| `.error()` | Errores que necesitan atención (exceptions, failed operations) |
| `.debug()` | Debug verbose — deshabilitado en producción                    |

---

## 7. Linting y Formatting

### Antes de Commit

```bash
# Backend
cd apps/back
npx eslint --fix src/**/*.ts
npx prettier --write src/**/*.ts

# Frontend
cd apps/front
npx eslint --fix .
npx prettier --write .
```

### Config Backend

```json
// apps/back/.prettierrc
{
  "singleQuote": true,
  "trailingComma": "all",
  "endOfLine": "lf"
}
```

### Config Frontend

```json
// apps/front/.prettierrc
{
  "singleQuote": true,
  "trailingComma": "all",
  "endOfLine": "lf"
}
```

### ESLint Rules Importantes

El proyecto tiene reglas custom en `eslint.config.mjs`:

```typescript
// configService.get() requiere { infer: true }
const config = configService.get('key', { infer: true }) // ✅
const config = configService.get('key') // ❌ Error ESLint

// Tests deben usar "should"
it('should return user when email exists', () => { ... })
it('should return null when email not found', () => { ... })

// No floating promises
await someAsyncFunction() // ✅
someAsyncFunction() // ❌ Error — requiere await
```

---

## 8. Funciones — Small y Pure

### Reglas

1. **< 30 líneas** por función
2. **Una responsabilidad** — hacer una cosa y hacerla bien
3. **Sin efectos secundarios** — misma entrada = misma salida
4. **Nombre descriptivo** — verbos para acciones, sustantivos para valores

```typescript
// ❌ INCORRECTO — función larga con múltiples responsabilidades
async function processUser(userData: any): Promise<User> {
  // 50 líneas de validación, guardado, email, logging, etc.
}

// ✅ CORRECTO — funciones pequeñas y enfocadas
function validateUserData(userData: unknown): userData is UserData {
  if (typeof userData !== "object" || userData === null) return false;
  return "email" in userData && "name" in userData;
}

async function saveUser(user: User): Promise<User> {
  return this.userRepository.save(user);
}

async function sendWelcomeEmail(user: User): Promise<void> {
  await this.mailService.send({
    to: user.email,
    template: "welcome",
    data: { name: user.name },
  });
}

async function createUser(userData: UserData): Promise<User> {
  if (!validateUserData(userData)) {
    throw new BadRequestException("Invalid user data");
  }
  const user = User.create(userData);
  const savedUser = await saveUser(user);
  await sendWelcomeEmail(savedUser);
  this.logger.log(`User created: ${savedUser.id}`);
  return savedUser;
}
```

---

## 9. Testing

### Pattern

```typescript
describe("UsersService", () => {
  let service: UsersService;
  let repository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(UserRepository);
  });

  describe("findByEmail", () => {
    it("should return user when email exists", async () => {
      const mockUser = { id: "1", email: "test@example.com" };
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail("test@example.com");

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
    });

    it("should return null when email not found", async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail("notfound@example.com");

      expect(result).toBeNull();
    });

    it("should throw when repository fails", async () => {
      repository.findOne.mockRejectedValue(new Error("DB connection failed"));

      await expect(service.findByEmail("test@example.com")).rejects.toThrow(
        "DB connection failed",
      );
    });
  });
});
```

### Reglas

1. **Tests con "should"** — requerido por ESLint
2. **Un describe por funcionalidad**
3. **Tests independientes** — no dependés de orden
4. **Mockear dependencias externas** — no pegar a DB real en unit tests
5. **AAA Pattern**: Arrange (setup), Act (execute), Assert (verify)

---

## 10. Errores Comunes

### Importaciones

| Error                                 | Solución                                                 |
| ------------------------------------- | -------------------------------------------------------- |
| `Module not found: @users/...`        | Verificar que el alias existe en `tsconfig.json`         |
| `Cannot find module './../../../...'` | Usar path alias en vez de relative                       |
| Import circular                       | Refactorizar — servicios no deben depender circularmente |

### Tipos

| Error                                    | Solución                                     |
| ---------------------------------------- | -------------------------------------------- |
| `Object is possibly null`                | Usar `?.` y `??`                             |
| `Parameter 'x' implicitly has 'any'`     | Tipar el parámetro o usar `unknown`          |
| `Type 'X' is not assignable to type 'Y'` | Verificar tipos — probablemente falta tipado |

### Null

| Error                              | Solución                                                |
| ---------------------------------- | ------------------------------------------------------- |
| `Cannot read property 'x' of null` | Usar optional chaining `obj?.x`                         |
| `Return can be possibly undefined` | Retornar `null` explícitamente o usar `NullableType<T>` |

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│ IMPORTS                                                         │
│ ✅ @users/domain/user  ❌ ../../../users/domain/user             │
│ ✅ import type { X }  ❌ import { TypeOnly }                    │
├─────────────────────────────────────────────────────────────────┤
│ TYPES                                                           │
│ ✅ unknown + guard  ❌ any                                       │
│ ✅ NullableType<T>   ❌ assuming not null                        │
├─────────────────────────────────────────────────────────────────┤
│ LOGGING                                                         │
│ ✅ this.logger.log()  ❌ console.log()                          │
├─────────────────────────────────────────────────────────────────┤
│ ENVIRONMENT                                                     │
│ ✅ configService.get()  ❌ hardcoded URLs/keys                   │
├─────────────────────────────────────────────────────────────────┤
│ FUNCTIONS                                                       │
│ ✅ < 30 lines     ❌ 100 line functions                          │
│ ✅ single res.    ❌ multiple responsibilities                  │
├─────────────────────────────────────────────────────────────────┤
│ TESTS                                                           │
│ ✅ it("should...")  ❌ it("test")                               │
│ ✅ independent     ❌ order-dependent                          │
└─────────────────────────────────────────────────────────────────┘
```
