# Foundation — Mapa de Desacoplamiento

> Documento que describe TODOS los puntos de desacoplamiento del monorepo Foundation,
> cómo funciona cada uno, y cómo añadir/quitar piezas sin romper el sistema.

---

## 1. Extensiones Backend — Auto-discovery

### Cómo funciona

```
apps/back/src/extensions/
├── crm/                    ← extensión base (sin dependencias)
├── affiliate/              ← depende de crm
├── upload-post/            ← sin dependencias
├── stripe/                 ← sin dependencias
└── cms/                    ← sin dependencias
```

El `ExtensionLoaderModule.register()` en `core/foundation.module.ts` escanea `extensions/*/extension.module.ts` en 5 fases:

1. **Fase 1 — Load manifests**: Lee `extensions/*/extension.manifest.ts` sin ejecutar el módulo
2. **Fase 2 — Detect conflicts**: Verifica conflictos de rutas, tablas, entidades duplicadas
3. **Fase 3 — Block errors**: Conflictos de severidad 'error' bloquean el registro
4. **Fase 3b — Skip missing deps**: Extensiones con dependencias faltantes se saltan con warning claro:
   ```
   ⚠️ Extension "affiliate" requires extension "crm" but it is not loaded.
   ⏭️ Skipping extension "affiliate" due to missing dependency
   ```
5. **Fase 4 — Resolve order**: Topological sort de dependencias (crm antes que affiliate)
6. **Fase 5 — Load modules**: `require()` de `extension.module.ts` en el orden resuelto

### Estructura de una extensión

```
extensions/<name>/
├── extension.manifest.ts    ← REQUERIDO: metadata, dependencies, routes, entities
├── extension.module.ts      ← REQUERIDO: NestJS module entry point
├── extension.config.ts      ← OPCIONAL: registerAs() para env vars
├── controllers/             ← REST controllers
├── services/                ← Business logic
├── dto/                     ← Request validation (class-validator)
├── infrastructure/persistence/entities/  ← TypeORM entities
└── seeds/                   ← Seed modules (auto-discovered por seed-loader)
```

### Manifest

```typescript
const manifest: ExtensionManifest = {
  name: 'affiliate',
  version: '1.0.0',
  dependencies: { extensions: ['crm'] },  // ← declara dependencia
  contributes: {
    routes: [{ method: 'POST', path: 'affiliate/partners' }, ...],
    entities: [
      { name: 'AffiliatePartner', table: 'ext_affiliate_partner' },
      { name: 'AffiliateReferral', table: 'ext_affiliate_referral' },
    ],
    seeds: true,
    config: [],  // si la extensión usa registerAs
  },
};
```

### Convenciones

| Convención | Regla |
|---|---|
| Ubicación | `src/extensions/<name>/` |
| Module file | `extension.module.ts` (requerido) |
| Manifest file | `extension.manifest.ts` (requerido) |
| Table prefix | `ext_<extension-name>_<entity>` (ej: `ext_crm_client`, `ext_affiliate_partner`) |
| Path alias | `@ext/<name>/...` (configurado en tsconfig.json) |
| Entity discovery | Automática via TypeORM glob `**/*.entity{.ts,.js}` |
| Module discovery | Automática via `ExtensionLoaderModule.register()` |
| Seeds | `seeds/seed.module.ts` con clase `*SeedModule` — auto-discovered |

### Añadir una extensión nueva

1. Crear carpeta `src/extensions/<name>/`
2. Crear `extension.manifest.ts` con dependencies
3. Crear `extension.module.ts` con NestJS module
4. Crear entities con prefijo `ext_<name>_*`
5. Si tiene config: crear `extension.config.ts` + añadir a `config.type.ts` y `infrastructure.module.ts`
6. No requiere tocar `app.module.ts` ni ningún archivo core — se auto-descubre

### Eliminar una extensión

1. Borrar la carpeta `src/extensions/<name>/`
2. Si era dependencia de otra: la dependiente se salta con warning claro (no crash)
3. Si tenía config: quitar de `config.type.ts` y `infrastructure.module.ts`
4. Si tenía frontend: quitar del `extends` array en `nuxt.config.ts` y su alias
5. Las tablas en DB quedan huérfanas (no se borran automáticamente) — hacer migration de cleanup

### Casos verificados

| Escenario | Resultado |
|---|---|
| Borrar `affiliate/`, mantener `crm/` | ✅ CRM funciona. App arranca sin affiliate |
| Borrar `crm/`, mantener `affiliate/` | ✅ App arranca. Affiliate se salta con warning claro. No hay import error críptico |
| Borrar ambas | ✅ App arranca sin extensiones |
| Borrar `stripe/` | ✅ App arranca. Stripe no existe. Nadie depende de stripe |
| Borrar `cms/` | ✅ App arranca. CMS no existe |
| Borrar `upload-post/` | ✅ App arranca. Upload-post no existe |

---

## 2. Extensiones Frontend — Nuxt Layers

### Cómo funciona

```
apps/front/
├── nuxt.config.ts          ← config principal, extends array + aliases
├── modules/base/           ← core frontend (auth, ui-app, storage, etc.)
├── modules/landing/        ← landing page
├── extensions/
│   ├── cms/                ← Nuxt layer (pages, composables, plugins)
│   ├── upload-post/        ← Nuxt layer
│   ├── crm/                ← Nuxt layer
│   └── affiliate/          ← Nuxt layer
```

### Registro en nuxt.config.ts

```typescript
export default defineNuxtConfig({
  extends: [
    './modules/landing',
    './modules/base',
    './extensions/cms',
    './extensions/upload-post',
    './extensions/crm',
    './extensions/affiliate',
  ],
  alias: {
    '@': '~/',
    '@base': '~/modules/base',
    '@cms': '~/extensions/cms',
    '@upload-post': '~/extensions/upload-post',
    '@crm': '~/extensions/crm',
    '@affiliate': '~/extensions/affiliate',
  },
});
```

### Estructura de un layer

```
extensions/<name>/
├── nuxt.config.ts          ← layer config (components, imports, compatibilityVersion 4)
├── plugins/
│   └── nav.ts              ← inyecta items en el sidebar
├── composables/
│   └── use<Name>.ts        ← API wrapper con $fetch
└── pages/
    └── app/<name>/         ← páginas (rutas auto-creadas)
```

### Añadir un layer nuevo

1. Crear carpeta `extensions/<name>/`
2. Crear `nuxt.config.ts` con `components`, `imports`, `compatibilityVersion: 4`
3. Crear páginas en `pages/app/<name>/`
4. Añadir `'./extensions/<name>'` al `extends` array en `nuxt.config.ts` principal
5. Añadir alias `'@<name>': '~/extensions/<name>'` si se usa en imports

### Eliminar un layer

1. Quitar del `extends` array en `nuxt.config.ts`
2. Quitar del `alias` si existe
3. Borrar la carpeta
4. El resto del frontend sigue funcionando

---

## 3. Roles y Redirección — Desacoplada via DB

### El problema

Antes: `useHomeRoute` tenía un map hardcoded:
```typescript
const roleRoutes = {
  admin: '/app',
  customer: '/app',
  // Add more roles here as needed
};
```

Cada vez que se añade un rol, había que tocar `useHomeRoute.ts` → no desacoplado.

### La solución

`RoleEntity` tiene una columna `homeRoute`:
```typescript
@Entity({ name: 'role' })
export class RoleEntity {
  @PrimaryColumn() id: number;
  @Column() name?: string;
  @Column({ type: String, nullable: true })  // ← NUEVA
  homeRoute?: string | null;
}
```

Seed en DB:
| id | name | homeRoute |
|---|---|---|
| 1 | admin | `/app` |
| 2 | customer | `/app` |
| 3 | affiliate | `/app/portal` |

`useHomeRoute` lee `homeRoute` del rol:
```typescript
const resolveHomeRoute = (role?: { name?: string; homeRoute?: string } | null) => {
  if (!role) return localePath(config.public.mainAppRoute);
  if (role.homeRoute) return localePath(role.homeRoute);
  return localePath(config.public.mainAppRoute);
};
```

### Cómo añadir un rol nuevo

1. Añadir al `RoleEnum`: `'new_role' = 4`
2. Añadir al `RoleSeedService`: seed con `homeRoute: '/app/new-section'`
3. No tocar `useHomeRoute` — ya funciona
4. No tocar `admin.global.ts` — ya maneja el caso (si la ruta empieza con `/app/` y el rol no es admin, redirige)

### El flujo completo de login

```
Usuario entra a /login
    ↓
AuthSignIn.vue: authStore.login(email, password)
    ↓
Backend: valida credenciales, retorna { token, refreshToken, user: { role: { name: 'affiliate', homeRoute: '/app/portal' } } }
    ↓
AuthSignIn: si hay ?redirect= → va ahí. Si no → useHomeRoute.navigateHome()
    ↓
useHomeRoute: lee role.homeRoute → navigateTo('/app/portal')
    ↓
admin.global.ts: verifica ruta
    ├── Si es affiliate y va a /app/portal → ✅ permite
    ├── Si es affiliate y va a /app (otra cosa) → redirige a /app/portal
    ├── Si es admin → ✅ permite todo /app/*
    └── Si no autenticado → redirige a /login
```

---

## 4. Sidebar — Inyección desacoplada via plugins

### Cómo funciona

El sidebar (`AppSidebar.vue`) lee de `useState('nav:menuItems')`. El composable `useNavMenu` mezcla items base (Home, Settings, Users) con items dinámicos.

```
useNavMenu.ts
    ├── Items base (hardcodeados):
    │   ├── General: Home (/app), Settings (/app/settings/profile)
    │   └── Admin (si isAdmin): Users (/app/users)
    │
    └── Items dinámicos (from extensions):
        └── useState('nav:menuItems') → []
            ↑
            Cada extensión inyecta via plugins/nav.ts
```

### Patrón de un plugin nav.ts

```typescript
// extensions/crm/plugins/nav.ts
export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<any[]>('nav:menuItems', () => []);

  const addCrmMenu = () => {
    if (!authStore.isAdmin) return;                    // ← solo admin
    if (menuItems.value.find(i => i.heading === 'CRM')) return;  // ← evita duplicados
    menuItems.value.push({
      heading: 'CRM',
      items: [
        { title: 'Dashboard', icon: 'LayoutDashboard', link: '/app/crm' },
        { title: 'Clientes', icon: 'Users', link: '/app/crm/clients' },
      ],
    });
  };

  addCrmMenu();
  watch(() => authStore.isAdmin, (isAdmin) => {        // ← cleanup al logout
    if (isAdmin) addCrmMenu();
    else menuItems.value = menuItems.value.filter(i => i.heading !== 'CRM');
  });
});
```

### Extensiones que inyectan en el sidebar

| Extensión | Heading | Visible para | Links |
|---|---|---|---|
| CRM | "CRM" | admin | Dashboard, Clientes, Configuración |
| Affiliate (admin) | "Afiliación" | admin | Dashboard, Partners, Referencias, Comisiones |
| Affiliate (portal) | "Portal" | affiliate | Dashboard, Mis referencias, Mis comisiones, Mi perfil |
| CMS | "CMS" | admin | Páginas, Blog, Categorías, Etiquetas |
| Upload-Post | (vía pages, no plugin) | admin | (pages auto-registradas) |
| Storage | "Storage" | admin | Archivos |
| Error Tracker | "System" | admin | Error logs |
| Translations | (vía plugin) | admin | Traducciones |

### Cómo añadir sidebar desde una extensión nueva

1. Crear `extensions/<name>/plugins/nav.ts`
2. Verificar `authStore.isAdmin` (o el rol que corresponda)
3. Push a `useState('nav:menuItems')`
4. Watch para cleanup
5. Nuxt auto-descubre el plugin — no registrar en ningún lado

### Cómo eliminar

Borrar el plugin `nav.ts` de la extensión. Los items desaparecen del sidebar. Si la extensión se borra entera, el plugin no se carga.

---

## 5. Perfil de Usuario — Getters en auth.store

### Getters

```typescript
// auth.store.ts
getters: {
  isAuthenticated: (state) => !!state.token,
  isAdmin: (state) => state.user?.role?.name === 'admin',
  isCustomer: (state) => state.user?.role?.name === 'customer',
  isAffiliate: (state) => state.user?.role?.name === 'affiliate',
}
```

### Persistencia

```typescript
persist: {
  paths: ['token', 'refreshToken', 'tokenExpires', 'user'],
  // ← refreshTokenTimeout NO se persiste (contiene setTimeout, no serializable)
}
```

### Tipo User

```typescript
interface User {
  id: string | number;
  firstName: string;
  lastName: string;
  email: string;
  role: {
    name: string;
    homeRoute?: string;  // ← del backend, no hardcoded en frontend
  };
  photo?: { path: string };
}
```

---

## 6. Middlewares — Protección de rutas

### Jerarquía de middlewares

```
1. admin.global.ts (GLOBAL — corre en TODA navegación a /app/*)
   ├── import.meta.server → skip
   ├── No autenticado → redirect a /login?redirect=...
   ├── Es affiliate y va a /app/portal/* → ✅ permite
   ├── Es affiliate y va a otra ruta /app/* → redirige a /app/portal
   ├── No es admin → 403
   └── Token expirado → refresh o redirect

2. auth.ts (NAMED — se usa en definePageMeta middleware: ['auth'])
   ├── import.meta.server → skip
   ├── No autenticado → redirect a /login
   └── Token expirado → intenta refresh

3. admin.ts (NAMED — middleware: ['auth', 'admin'])
   ├── No autenticado → redirect a /login
   └── No admin → redirect a /app

4. guest.ts (NAMED — middleware: ['guest'])
   └── Ya autenticado → redirect a home
```

### Qué protege qué

| Ruta | Middleware | Quién puede acceder |
|---|---|---|
| `/login`, `/register`, `/forgot-password` | `guest` | Solo no autenticados |
| `/app/*` (general) | `admin.global` (global) | Solo admin + affiliate en portal |
| `/app/crm/*` | `['auth', 'admin']` (page) + `admin.global` | Solo admin |
| `/app/affiliate/*` | `['auth', 'admin']` (page) + `admin.global` | Solo admin |
| `/app/portal/*` | `['auth']` (page) + `admin.global` (permite affiliate) | Admin + affiliate |
| `/admin/*` | `['auth', 'admin']` (page) | Solo admin |

---

## 7. Relaciones @OneToOne → @ManyToOne

### El problema

Las entidades de Stripe usaban `@OneToOne` incorrectamente:
- `Price → Product`: un producto tiene múltiples precios
- `Subscription → Plan`: un plan tiene múltiples suscripciones
- `UsageRecord → Subscription`: una suscripción tiene múltiples usage records

### La solución

```typescript
// ANTES (incorrecto):
@OneToOne(() => ProductEntity)
@JoinColumn({ name: 'productId' })
product: ProductEntity;

// DESPUÉS (correcto):
@ManyToOne(() => ProductEntity, { eager: false })
@JoinColumn({ name: 'productId' })
product: ProductEntity;
```

`@ManyToOne` permite que múltiples registros hijo apunten al mismo padre.

### Regla

| Relación | TypeORM decorator | Ejemplo |
|---|---|---|
| 1:1 (un A tiene un B, un B tiene un A) | `@OneToOne` | User → UserProfile |
| N:1 (muchos A tienen un B) | `@ManyToOne` | Price → Product, Subscription → Plan |
| 1:N (un A tiene muchos B) | `@OneToMany` (en el otro lado) | Product → Prices[] |

### En Foundation

| Entity | Relación | Decorator | onDelete |
|---|---|---|---|
| `Price → Product` | N:1 | `@ManyToOne` | (default RESTRICT) |
| `Subscription → Plan` | N:1 | `@ManyToOne` | (default RESTRICT) |
| `UsageRecord → Subscription` | N:1 | `@ManyToOne` | (default RESTRICT) |
| `CrmClient → CrmStatus` | N:1 | `@ManyToOne` | (default RESTRICT) |
| `CrmClient → CrmOrigin` | N:1 | `@ManyToOne` | `SET NULL` |
| `CrmContact → CrmClient` | N:1 | `@ManyToOne` | `CASCADE` |
| `CrmInteraction → CrmClient` | N:1 | `@ManyToOne` | `CASCADE` |
| `CrmInteraction → CrmContact` | N:1 | `@ManyToOne` | `SET NULL` |
| `CrmProject → CrmClient` | N:1 | `@ManyToOne` | `CASCADE` |
| `AffiliatePartner → CrmClient` | N:1 | `@ManyToOne` | `SET NULL` |
| `AffiliatePartner → User` | N:1 | `@ManyToOne` | `SET NULL` |
| `AffiliateReferral → AffiliatePartner` | N:1 | `@ManyToOne` | `CASCADE` |
| `AffiliateReferral → CrmClient` | N:1 | `@ManyToOne` | `CASCADE` |
| `AffiliateReferral → CrmOrigin` | N:1 | `@ManyToOne` | `SET NULL` |
| `AffiliateCommission → AffiliateReferral` | N:1 | `@ManyToOne` | `CASCADE` |
| `AffiliateCommission → CrmProject` | N:1 | `@ManyToOne` | `CASCADE` |

---

## 8. Notificaciones de Email — Env var global

### Cadena de prioridad

```
1. Env var específica de extensión (ej: UPLOAD_POST_WEEKLY_REPORT_EMAIL)
2. Env var global: NOTIFICATION_EMAIL
3. Sin email → logger.warn + return (no envía)
```

### Config

```typescript
// app-config.type.ts
export type AppConfig = {
  // ...otros campos...
  notificationEmail?: string;  // ← global
};

// app.config.ts
notificationEmail: process.env.NOTIFICATION_EMAIL,
```

### Uso

```typescript
// En cualquier extensión:
const email =
  this.configService.get('upload-post', { infer: true })?.weeklyReportEmail ||  // específico
  this.configService.get('app', { infer: true })?.notificationEmail;             // global

if (!email) {
  this.logger.warn('No notification email configured — skipping');
  return;
}
```

### .env

```bash
NOTIFICATION_EMAIL=hola@som-os.dev
# Override por extensión:
UPLOAD_POST_WEEKLY_REPORT_EMAIL=adrian@som-os.dev
```

---

## 9. Seeds — Auto-discovery + Upsert

### Auto-discovery

El `seed-loader.ts` escanea `extensions/*/seeds/seed.module.ts` buscando clases que terminen en `*SeedModule`. Se cargan automáticamente.

### Patrón upsert

```typescript
// ANTES (solo insert, no actualiza si existe):
const count = await this.repository.count({ where: { id: RoleEnum.admin } });
if (!count) {
  await this.repository.save(this.repository.create({ id: 1, name: 'admin', homeRoute: '/app' }));
}

// DESPUÉS (upsert: inserta si no existe, actualiza si cambió):
const existing = await this.repository.findOne({ where: { id: RoleEnum.admin } });
if (!existing) {
  await this.repository.save(this.repository.create({ id: 1, name: 'admin', homeRoute: '/app' }));
} else if (existing.homeRoute !== '/app') {
  existing.homeRoute = '/app';
  await this.repository.save(existing);
}
```

---

## 10. Componentes UI — @base/ui-app

### Regla

> **SIEMPRE** usar componentes `@base/ui-app/` — NUNCA crear custom si ya existe uno base.

### Componentes disponibles

| Categoría | Componentes | Import path |
|---|---|---|
| **Form** | FormInput, FormTextArea, FormSelect, FormSearchSelect, FormMultipleSelect, FormDate, FormTime, FormPassword, FormSwitch, FormFile, FormMultipleFile | `@base/ui-app/components/form/` |
| **DataTable** | DataTable, DataTableComboboxFilter, DataTableColumnHeader, SortableHeader, EditButton, ViewButton, DeleteButton | `@base/ui-app/components/data-table/` |
| **Rich Editor** | RichEditor | `@base/ui-app/components/rich-editor/` |
| **Calendar** | Calendar, CalendarToolbar, CalendarMonthView, CalendarWeekView, CalendarDayView, CalendarEvent | `@base/ui-app/components/calendar/` |
| **Kanban** | Kanban, KanbanColumn, KanbanCard, KanbanTag, UserAvatar | `@base/ui-app/components/kanban/` |
| **Storage** | StorageUploadModal | `@base/ui-app/components/storage/` |

### FormInput API

```vue
<FormInput
  v-model="form.email"
  label="Email"
  type="email"
  placeholder="user@example.com"
  required
  :error="errors.email"
  description="Tu email de contacto"
/>
```

### FormSelect API

```vue
<FormSelect
  v-model="form.statusId"
  label="Estado"
  :options="statusOptions"
  placeholder="Selecciona..."
  required
  :error="errors.statusId"
/>
```

### DataTable API

```vue
<DataTable
  :columns="columns"
  :data="data"
  :total="total"
  manual
  table-name="crm-clients"
  @row-click="(row) => navigateTo(`/app/crm/clients/${row.id}`)"
/>
```

### Column definition

```typescript
const columns = [
  { accessorKey: 'name', headerName: 'Nombre', header: 'Nombre', filterType: 'string' as const },
  { accessorKey: 'email', headerName: 'Email', header: 'Email', filterType: 'string' as const },
  {
    accessorKey: 'status',
    headerName: 'Estado',
    header: 'Estado',
    filterType: 'select' as const,
    options: [{ value: 'lead', label: 'Lead' }, { value: 'active', label: 'Activo' }],
  },
];
```

---

## 11. Dependencias entre extensiones

### Grafo de dependencias

```
crm          ← base (sin dependencias)
affiliate    ← depende de crm (FK a crm_client, crm_project, crm_origin)
upload-post  ← sin dependencias
stripe       ← sin dependencias
cms          ← sin dependencias
```

### Cómo se declaran

```typescript
// affiliate/extension.manifest.ts
dependencies: { extensions: ['crm'] }
```

### Cómo se importan

```typescript
// affiliate/extension.module.ts
import { CrmClientEntity } from '@ext/crm/infrastructure/persistence/entities/crm-client.entity';
import { CrmProjectEntity } from '@ext/crm/infrastructure/persistence/entities/crm-project.entity';
import { CrmOriginEntity } from '@ext/crm/infrastructure/persistence/entities/crm-origin.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // propias
      AffiliatePartnerEntity,
      AffiliateReferralEntity,
      AffiliateCommissionEntity,
      // de CRM (dependencia)
      CrmClientEntity,
      CrmProjectEntity,
      CrmOriginEntity,
    ]),
  ],
})
```

### Regla de dirección

```
affiliate → importa de crm ✅ (affiliate sabe que crm existe)
crm → NO importa de affiliate ✅ (crm no sabe que affiliate existe)
```

Si borras affiliate → crm sigue funcionando ✅
Si borras crm → affiliate no carga (warning claro) ✅

---

## 12. Config de extensión — registerAs

### Patrón

```typescript
// extension.config.ts
export default registerAs<MyExtConfig>('my-extension', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);
  return {
    apiKey: process.env.MY_EXT_API_KEY,
  };
});
```

### Wiring (one-time por extensión con config)

1. `config.type.ts` — añadir `'my-extension': MyExtConfig` a `AllConfigType`
2. `infrastructure.module.ts` — añadir `myExtConfig` al `load: [...]` del ConfigModule

### Acceso

```typescript
constructor(private readonly configService: ConfigService<AllConfigType>) {}

const cfg = this.configService.get('my-extension', { infer: true });
```

### Configs registradas

| Extensión | Config key | Env vars |
|---|---|---|
| upload-post | `'upload-post'` | `UPLOAD_POST_API_KEY`, `UPLOAD_POST_PROFILE_USERNAME`, `UPLOAD_POST_WEBHOOK_SECRET`, `UPLOAD_POST_WEEKLY_REPORT_CRON`, `UPLOAD_POST_WEEKLY_REPORT_EMAIL` |
| stripe | `'stripe'` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, etc. |
| App (global) | `'app'` | `NOTIFICATION_EMAIL`, `APP_NAME`, `APP_PORT`, etc. |
| Mail | `'mail'` | `MAIL_HOST`, `MAIL_PORT`, `MAIL_DEFAULT_EMAIL`, etc. |

---

## 13. Tabla resumen — Qué tocar para cada operación

| Operación | Qué archivos tocar |
|---|---|
| Añadir extensión backend | Crear carpeta `extensions/<name>/` con manifest + module. Si tiene config: añadir a `config.type.ts` + `infrastructure.module.ts` |
| Eliminar extensión backend | Borrar carpeta. Si tenía config: quitar de `config.type.ts` + `infrastructure.module.ts` |
| Añadir extensión frontend | Crear carpeta `extensions/<name>/` con nuxt.config.ts. Añadir al `extends` array + alias en `nuxt.config.ts` |
| Eliminar extensión frontend | Quitar del `extends` array + alias. Borrar carpeta |
| Añadir rol nuevo | `RoleEnum` + `RoleSeedService` (con homeRoute). No tocar useHomeRoute ni admin.global |
| Añadir item al sidebar | Crear `plugins/nav.ts` en la extensión. Push a `useState('nav:menuItems')` |
| Añadir página admin | Crear `.vue` en `pages/app/<name>/` con `definePageMeta({ middleware: ['auth', 'admin'] })` |
| Añadir página portal | Crear `.vue` en `pages/app/portal/<name>/` con `definePageMeta({ middleware: ['auth'] })` |
| Añadir env var global | `app-config.type.ts` + `app.config.ts` + `.env.example` |
| Añadir env var de extensión | `extension.config.ts` + `config.type.ts` + `infrastructure.module.ts` + `.env.example` |
| Cambiar ruta de redirect de un rol | Solo en DB: update `role.homeRoute` en seed o via admin. No tocar código |
| Añadir entidad | Crear `.entity.ts` con `@Entity('ext_<name>_<entity>')`. Auto-discovered por TypeORM |
| Añadir controller | Crear `.controller.ts` con `@Controller({ path: '<ext>/<resource>', version: '1' })`. Registrar en `extension.module.ts` |
| Añadir DTO | Crear `.dto.ts` con class-validator. Importar en controller |
| Añadir seed | Crear `seeds/seed.module.ts` con clase `*SeedModule`. Auto-discovered |
| Cambiar tabla de entidad | `@Entity('new_table_name')` + migration. Si se referencia en manifest, actualizar |