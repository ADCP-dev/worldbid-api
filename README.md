# Foundation Monorepo

Este es un monorepo gestionado con **Turborepo** que contiene tanto el frontend como el backend del proyecto Foundation.

## 🛠️ Instalación

Para instalar todas las dependencias del proyecto, ejecuta el siguiente comando desde la **raíz** del monorepo:

```bash
pnpm install
```

## 🚀 Ejecución en Local

Puedes ejecutar cada una de las aplicaciones de forma independiente navegando a su respectiva carpeta dentro de `apps/`.

### Frontend

Para iniciar el servidor de desarrollo del frontend:

```bash
cd apps/front
pnpm dev
```

### Backend

Para iniciar el servidor de desarrollo del backend:

```bash
cd apps/back
pnpm dev
```

## 🐳 Ejecución con Docker

Si prefieres ejecutar todo el stack (Frontend, Backend, Base de Datos, Redis, Mailpit) con Docker, simplemente ejecuta:

```bash
docker-compose up --build
```

Esto levantará:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Mailpit** (Emails): http://localhost:8025
- **Redis**: Puerto 6379

## 📦 Estructura del Proyecto

Este monorepo incluye las siguientes aplicaciones y paquetes:

- `apps/front`: Aplicación Frontend (Nuxt.js).
- `apps/back`: Aplicación Backend (NestJS).
- `packages/*`: Configuraciones compartidas de TypeScript, ESLint, etc. (Turbo default structure).

---

Desarrollado con ❤️ por el equipo de Foundation.
