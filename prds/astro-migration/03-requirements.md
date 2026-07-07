---
doc: astro-migration/03-requirements
title: "Requisitos (FR-NNN EARS + NFR-NNN)"
status: draft
created: 2026-07-07
updated: 2026-07-07
---

# Requisitos (FR-NNN EARS + NFR-NNN)

Notación EARS. Cada FR referenciado por número en fases (`06-migration-phases.md`) y DoD (`08-definition-of-done.md`).

## Requisitos funcionales (FR-NNN)

### Landing y estructura web

**FR-001: Landing prerendered**
THE SYSTEM SHALL serve the landing page (`/`) as static HTML with zero client-side JavaScript by default.

**FR-002: Componentes landing reescritos**
WHEN la Fase 1 finalice, THE SYSTEM SHALL servir los 16 componentes actuales de `modules/landing/` reescritos como componentes `.astro` en `apps/web/src/components/landing/`.

**FR-003: Layout público**
THE SYSTEM SHALL render landing, blog y pages CMS dentro de un `PublicLayout.astro` compartido (navbar + footer) consistente con el design system de `packages/ui/`.

### Blog y content

**FR-004: Blog servido desde Astro**
WHEN un usuario solicite `/blog/**`, THE SYSTEM SHALL servir el contenido desde `apps/web/` (Astro) y NO desde `apps/front/` (Nuxt).

**FR-005: Rutas blog**
THE SYSTEM SHALL exponer las rutas `/blog`, `/blog/[slug]`, `/blog/c/[slug]` (categoría corta) y `/blog/category/[slug]`, todas con HTML estático.

**FR-006: Páginas CMS dinámicas**
WHEN NestJS contenga una página publicada con slug `X`, THE SYSTEM SHALL generar la ruta estática `/page/[X]` en Astro fetcheando `/api/v1/cms/pages/public` en build time.

**FR-007: Blog vía API NestJS en build time**
THE SYSTEM SHALL obtener el contenido del blog editorial fetcheando `/api/v1/cms/blog/posts/public` en build time. CMS (NestJS) es fuente única de verdad para TODO el contenido (blog + pages). NO content collections, NO markdown en repo.

### Páginas error

**FR-008: Páginas error estáticas**
WHEN el usuario solicite una ruta inexistente o el servidor falle, THE SYSTEM SHALL servir `/404.astro` o `/500.astro` como HTML estático desde Astro.

### i18n — Modo B (build-time fetch backend)

**FR-009: i18n es/en por defecto**
THE SYSTEM SHALL servir el sitio en `es` (default, sin prefijo) y `en` (con prefijo `/en/...`) usando estrategia `prefix_except_default` consistente con el Nuxt actual. Locales adicionales desde DB vía fetch build time.

**FR-010: Strings UI desde módulo de traducciones**
THE SYSTEM SHALL cargar strings UI (nav, footer, botones, labels) fetcheando el módulo de traducciones de NestJS en build time, con fallback a JSON estático es/en en `apps/web/src/i18n/` si la API cae (NFR-007).

**FR-011: Contenido CMS por locale**
IF el backend NestJS devuelve páginas traducidas para un locale, THEN THE SYSTEM SHALL generar rutas estáticas por cada locale (`/page/[slug]` para `es`, `/en/page/[slug]` para `en`) fetcheando `/api/v1/cms/pages/public?lang=<locale>` en build time.

### SEO

**FR-012: Sitemap**
THE SYSTEM SHALL generar `sitemap-index.xml` + `sitemap-0.xml` automáticamente vía `@astrojs/sitemap` incluyendo todas las rutas estáticas y dinámicas.

**FR-013: RSS feed**
THE SYSTEM SHALL servir `rss.xml` con los posts publicados (no draft) vía `@astrojs/rss`, fetcheando desde la API NestJS en build time.

**FR-014: Meta tags SEO**
THE SYSTEM SHALL generar meta tags `<title>`, `<meta description>`, OpenGraph y Twitter cards en todas las páginas vía `astro-seo`.

**FR-015: JSON-LD**
THE SYSTEM SHALL emitir JSON-LD por tipo de página: `Organization`+`WebSite` en `/`, `Blog` en `/blog`, `BlogPosting`+`BreadcrumbList` en `/blog/[slug]`, `WebPage` en `/page/[slug]`.

**FR-016: OG images**
THE SYSTEM SHALL generar imágenes OG dinámicas por post (PNG) en `public/og/` o vía Satori.

### Render e islands

**FR-017: Islands Vue explícitos**
WHEN una página requiera interactividad, THE SYSTEM SHALL hidratar un island Vue con directivas `client:load`, `client:visible` o `client:idle` según necesidad, manteniendo 0 JS en el resto de la página.

**FR-018: NewsletterForm island**
THE SYSTEM SHALL proveer un island `NewsletterForm.vue` para suscripción a newsletter, llamando a la API de NestJS en runtime.

### Deploy

**FR-019: Build estático**
WHEN se ejecute `astro build`, THE SYSTEM SHALL producir `dist/` con archivos estáticos servibles desde Coolify sin Node server.

**FR-020: Deploy dual independiente**
THE SYSTEM SHALL desplegar `apps/web/` y `apps/front/` en pipelines CI/CD separados con triggers independientes (push a `apps/web/**` o `apps/front/**` respectivamente), via Coolify.

**FR-021: Deploy hook Coolify para rebuild**
WHEN un admin publique o edite un post/página en NestJS, THEN THE SYSTEM SHALL invocar el deploy hook existente en Coolify para re-trigger el build de Astro. No se implementa webhook nuevo.

### Limpieza Nuxt (Fase 4)

**FR-022: Remover modules/landing**
WHEN la Fase 4 finalice, THE SYSTEM SHALL tener `apps/front/` sin `modules/landing/`, sin `extensions/cms/pages/blog/` y sin `extensions/cms/pages/page/`.

**FR-023: nuxt.config limpio**
THE SYSTEM SHALL tener `nuxt.config.ts` sin `modules/landing` en `extends`, sin `routeRules` para `/blog/**`, `/page/**`, `/`, `/en`, y sin alias `@landing`. Configurado con `ssr: false` (SPA puro).

**FR-024: Backoffice intacto**
WHEN la Fase 4 finalice, THE SYSTEM SHALL servir `/app/**` y las auth pages (`/login`, `/register`, `/forgot-password`, `/password-change`, `/login-basic`) sin regresiones funcionales.

### `packages/ui/`

**FR-025: Tokens exportados**
THE SYSTEM SHALL exportar design tokens (colores, tipografía, spacing, breakpoints, radius, shadows) en formato JSON como fuente de verdad en `packages/ui/src/tokens/`. Sin variantes dark mode (Q-014).

**FR-026: Tailwind preset**
THE SYSTEM SHALL exportar un Tailwind preset consumible desde `apps/web/tailwind.config.ts` y `apps/front/tailwind.config.ts` vía `@foundation/ui/tailwind/preset`.

**FR-027: DaisyUI theme**
THE SYSTEM SHALL exportar un DaisyUI theme consumible por ambas apps vía `@foundation/ui/daisyui/theme`. Sin variantes dark.

**FR-028: Workspace package**
THE SYSTEM SHALL declarar `@foundation/ui` como `workspace:*` en `pnpm-workspace.yaml` sin publicación a npm registry externo. Build con `tsup`.

## Requisitos no funcionales (NFR-NNN)

### Performance

**NFR-001: Lighthouse performance landing**
THE SYSTEM SHALL rendir landing con Lighthouse performance score >= 95.

**NFR-002: Cero JS landing**
THE SYSTEM SHALL servir landing con JS payload < 10 KB (idealmente 0 KB salvo fonts/preload).

**NFR-003: Core Web Vitals**
THE SYSTEM SHALL cumplir LCP < 2.5 s, CLS < 0.1, INP < 200 ms en landing.

### SEO

**NFR-004: URLs consistentes**
THE SYSTEM SHALL mantener las mismas URLs públicas que el sitio Nuxt actual (`/blog/[slug]`, `/page/[slug]`) para preservar ranking SEO. Si alguna URL cambia, THE SYSTEM SHALL emitir redirect 301.

**NFR-005: Sitemap válido**
THE SYSTEM SHALL servir `sitemap-index.xml` accesible en `https://midominio.com/sitemap-index.xml` con todas las URLs canónicas.

### Accesibilidad

**NFR-006: WCAG AA**
THE SYSTEM SHALL cumplir WCAG 2.1 AA en todas las páginas públicas (contraste, navegable por teclado, alt en imágenes, ARIA donde aplique).

### i18n

**NFR-007: Fallback estático si backend cae**
WHEN la API NestJS no esté disponible en build time, THE SYSTEM SHALL generar el sitio usando fallback estático es/en de `apps/web/src/i18n/{es,en}.json`. Build acoplado a backend por defecto (Modo B), con fallback graceful.

### Seguridad

**NFR-008: Sin secrets en estático**
THE SYSTEM SHALL NO incluir tokens, claves ni secrets en el bundle estático de Astro. Solo vars `PUBLIC_*` expuestas al cliente.

**NFR-009: CORS whitelist NestJS**
THE SYSTEM SHALL configurar CORS en NestJS permitiendo únicamente orígenes `midominio.com` (Astro islands) y `app.midominio.com` (Nuxt admin).

### Mantenibilidad

**NFR-010: TypeScript estricto**
THE SYSTEM SHALL compilar ambos apps con `pnpm check-types` sin errores en pipelines CI.

**NFR-011: Lint passing**
THE SYSTEM SHALL pasar `pnpm lint` (eslint + prettier) en ambos apps sin errores.

### Build determinismo

**NFR-012: Build reproducible con mismo backend state**
WHEN el mismo commit se buildée dos veces con el mismo estado de backend, THE SYSTEM SHALL producir output idéntico (salvo timestamps generados).

## Criterios de aceptación por requisito complejo

- **FR-006**: Given una página CMS publicada con slug `about` en NestJS; When se ejecuta `astro build`; Then existe `dist/page/about/index.html` con contenido HTML de la página.
- **FR-021**: Given admin edita page `about` en NestJS; When se guarda; Then NestJS invoca deploy hook de Coolify; Then Coolify re-build Astro; Then en el próximo deploy `dist/page/about/index.html` refleja el nuevo contenido.
- **FR-024**: Given Fase 4 completada; When un usuario admin navega a `/app/dashboard`; Then la página carga sin errores y la auth funciona con login/refresh.
- **NFR-004**: Given URL `/blog/mi-post` existe en Nuxt actual; When migra a Astro; Then `/blog/mi-post` sirve el mismo contenido desde Astro; Then no hay redirect 301 innecesario.

## Pendientes de clarificación

- `[NEEDS CLARIFICATION]` Path exacto de `cors.config.ts` en backend (NFR-009).
- `[NEEDS CLARIFICATION]` Endpoint exacto del módulo de traducciones para strings UI (FR-010).