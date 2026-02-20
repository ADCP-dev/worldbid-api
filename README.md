# Foundation Monorepo

Monorepo gestionado con **Turborepo** que contiene el frontend (**Nuxt 3**) y el backend (**NestJS**) del proyecto Foundation.

## � Documentación

Toda la documentación técnica está en `docs/`:

| Documento | Contenido |
|---|---|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Estructura del proyecto, carpetas `src/`, alias TypeScript |
| [BACKEND-RESOURCES.md](./docs/BACKEND-RESOURCES.md) | Crear módulos CRUD, migraciones, seeds, anatomía de módulos |
| [AUTHORIZATION.md](./docs/AUTHORIZATION.md) | Decoradores de auth, guards, RBAC backend y frontend |
| [FRONTEND-LAYERS.md](./docs/FRONTEND-LAYERS.md) | Nuxt layers, middleware, auth store, API calls, componentes UI |
| [EMAIL-SYSTEM.md](./docs/EMAIL-SYSTEM.md) | MailService, templates Maizzle, cola BullMQ, configuración SMTP |
| [GENERATORS.md](./docs/GENERATORS.md) | Comandos Hygen, crear recursos, añadir propiedades |
| [EXTENSIONS-SYSTEM.md](./docs/EXTENSIONS-SYSTEM.md) | Sistema de extensiones dinámicas |

---

## 🛠️ Instalación

Desde la **raíz** del monorepo:

```bash
pnpm install
```

---

## 🚀 Ejecución en Local

```bash
# Ambas apps a la vez (desde la raíz)
pnpm dev

# Solo frontend
cd apps/front && pnpm dev

# Solo backend
cd apps/back && pnpm dev
```

Servicios:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Swagger**: http://localhost:3001/docs

---

## 🐳 Docker

Levanta todo el stack (Frontend, Backend, PostgreSQL, Redis, Mailpit):

```bash
docker-compose up --build
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| Mailpit (emails) | http://localhost:8025 |
| Redis | puerto 6379 |

---

## 📦 Estructura del Monorepo

```
foundation/
├── apps/
│   ├── front/          # Nuxt 3 SPA
│   └── back/           # NestJS API + PostgreSQL + TypeORM
├── docs/               # Documentación técnica
└── docker-compose.yml
```

### Backend (`apps/back/src/`)

```
src/
├── config/             # Config global (app, worker)
├── core/               # Extension loader
├── i18n/               # Traducciones JSON
├── infrastructure/     # Database, mailer, utils
└── modules/
    ├── iam/            # Auth, roles, session, API keys
    ├── users/          # Usuarios y estados
    ├── communications/ # Mail, email-queue, home
    ├── billing/        # Stripe
    ├── storage/        # Archivos (local / S3)
    └── social/
```

### Frontend (`apps/front/modules/`)

```
modules/
├── auth/               # Login, registro, recuperación de contraseña
├── ui-app/             # DataTable, Form components, sidebar
└── <feature>/          # Módulos por funcionalidad
```

---

## ⚙️ Variables de Entorno

Copia `apps/back/.env.example` → `apps/back/.env`. Variables clave:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `AUTH_JWT_SECRET` | Secreto JWT |
| `MAIL_HOST`, `MAIL_PORT` | Servidor SMTP |
| `FILE_DRIVER` | `local` o `s3` |
| `REDIS_URL` | Requerido para la cola de emails |
| `STRIPE_SECRET_KEY` | Integración Stripe |

---

## 🧰 Comandos útiles (desde `apps/back`)

```bash
pnpm generate:resource      # Crea un módulo CRUD completo
pnpm add:property           # Añade una propiedad a un recurso
pnpm migration:generate     # Genera migración desde los cambios en entidades
pnpm migration:run          # Ejecuta migraciones pendientes
pnpm seed:run               # Ejecuta seeders (roles, usuarios iniciales)
```

---

Desarrollado con ❤️ por el equipo de Foundation.
