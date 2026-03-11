# Documentation Index

| Document                                             | Topics                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [ARCHITECTURE.md](./ARCHITECTURE.md)                 | Monorepo layout, backend `src/` directory structure, TypeScript path aliases, frontend layer system                 |
| [BACKEND-RESOURCES.md](./BACKEND-RESOURCES.md)       | Creating CRUD modules, adding properties, TypeORM migrations, seeds, module anatomy, DTO validation                 |
| [AUTHORIZATION.md](./AUTHORIZATION.md)               | Auth decorators (`@JwtAuth`, `@AdminAuth`…), guards, RBAC, role+ownership patterns, custom Nuxt middleware          |
| [API-KEYS.md](./API-KEYS.md)                         | Permanent API keys for integrations — format, endpoints, guards (`@ApiKeyAuth`, `@FlexibleAuth`), security          |
| [WEBHOOKS.md](./WEBHOOKS.md)                         | Webhook standard — event naming, payload envelope, dispatch service, signature verification, retries, idempotency   |
| [FRONTEND-LAYERS.md](./FRONTEND-LAYERS.md)           | Nuxt layers, page routing, middleware, auth store, `fetchWrapper`, TanStack Query, sidebar injection, UI components |
| [EMAIL-SYSTEM.md](./EMAIL-SYSTEM.md)                 | MailService methods, Maizzle templates, BullMQ queue, SMTP config, i18n in emails                                   |
| [GENERATORS.md](./GENERATORS.md)                     | Hygen commands, EJS template format, customizing and creating generators                                            |
| [EXTENSIONS-SYSTEM.md](./EXTENSIONS-SYSTEM.md)       | Dynamic extension modules (backend + frontend copy-paste architecture)                                              |
| [TRANSLATIONS.md](./TRANSLATIONS.md)                 | i18n system, translation keys, AI translation, frontend accordion editor                                            |
| [MCP-VECTOR-SEARCH.md](./MCP-VECTOR-SEARCH.md)       | Semantic code search for AI assistants — MCP server, Qdrant integration, OpenCode setup                             |
| [ERROR-LOGGING.md](./ERROR-LOGGING.md)               | Error tracking system — automatic error capture, deduplication, visual dashboard, Telegram notifications            |
| [STORAGE-ARCHITECTURE.md](./STORAGE-ARCHITECTURE.md) | File storage system — Local/S3 drivers, polymorphic relationships, automatic cleanup with TypeORM subscribers       |
