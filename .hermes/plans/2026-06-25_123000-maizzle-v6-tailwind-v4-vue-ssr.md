# Plan — Maizzle v6 + Tailwind v4 + Vue SSR en NestJS (matar Handlebars)

> **Issue**: https://github.com/ADCP-dev/foundation/issues/81
> **Cambio**: `sdd/maizzle-v6-tailwind-v4-vue-ssr`
> **Stack objetivo**: Maizzle 6.x, Tailwind 4.x, Vue 3 SSR, `@maizzle/framework` v6 en NestJS.
> **Scope del plan**: Backend email system completo (`apps/back/src/modules/communications/mail/*` + `apps/back/maizzle.config.js` + `apps/back/tailwind.email.config.js` + `apps/back/scripts/flatten-maizzle-output.js` + `apps/back/package.json`).
> **No scope**: Frontend, auth, billing, infra. i18n strings se mantienen intactas (vienen de `nestjs-i18n` y se interpolan en runtime, no en plantilla).

---

## 0. Estado actual (mapeo)

### Archivos a tocar (todos verificados)

```
apps/back/
├── package.json                                            # bump @maizzle/framework a ^6, matar handlebars
├── maizzle.config.js                                       # reescritura v6 (CSS-first, sin tailwind.config.js)
├── tailwind.email.config.js                                # KILL — v4 usa @theme en CSS
├── scripts/flatten-maizzle-output.js                       # KILL — v6 no necesita flatten
├── src/
│   ├── infrastructure/mailer/
│   │   └── mailer.service.ts                               # render: Handlebars → Maizzle.render() con Vue
│   ├── modules/communications/mail/
│   │   ├── mail.module.ts                                  # registrar Maizzle config
│   │   ├── mail.service.ts                                 # sin cambios funcionales (sigue llamando render)
│   │   ├── helpers/
│   │   │   └── mail-template-path.helper.ts                # .hbs → .vue; emails/ sigue Maizzle source, build/ se va
│   │   ├── mail-templates/
│   │   │   ├── emails/                                     # source v6 (.vue, con <script setup defineConfig>)
│   │   │   │   ├── activation.vue                          # port de activation.hbs
│   │   │   │   ├── reset-password.vue                      # port de reset-password.hbs
│   │   │   │   └── confirm-new-email.vue                   # port de confirm-new-email.hbs
│   │   │   ├── layouts/                                    # layout v6 (.vue)
│   │   │   │   └── main.vue                                # port de main.hbs
│   │   │   ├── css/
│   │   │   │   └── main.css                                # @import "@maizzle/tailwindcss"; @theme {}
│   │   │   ├── build/                                      # KILL — v6 render directo, sin build step
│   │   │   └── config.ts                                   # NEW — defineConfig global Maizzle
│   │   └── email-queue/
│   │       └── email.processor.ts                          # sin cambios (delega en MailerService)
│   └── i18n/                                               # SIN cambios — subjects siguen por nestjs-i18n
└── docs/modules/email.md                                   # actualizar secciones "Templates", "Build Command", "Conventions"
```

### Dependencias actuales vs objetivo

| Paquete | Actual | Objetivo | Acción |
|---|---|---|---|
| `@maizzle/framework` | `^5.0.8` | `^6.0.0` | bump |
| `handlebars` | `4.7.8` | — | remove |
| `tailwindcss-preset-email` | `^1.4.0` | — | remove (v6 trae `@maizzle/tailwindcss`) |
| `vue` | (no en package.json) | `^3.5.0` | add (SSR para Maizzle) |
| `@vue/compiler-ssr` | — | `^3.5.0` | add (peer dep implícita) |
| `nodemailer` | `6.10.1` | `6.10.1` | sin cambios |
| `bullmq` | `^5.68.0` | `^5.68.0` | sin cambios |

### Convenciones del repo a respetar

- AGENTS.md §11.7 — lint con `eslint --fix` + `prettier --write` antes de commit.
- AGENTS.md §11.8 — scope mínimo, no tocar archivos no relacionados.
- AGENTS.md §1 — conventional commits, NO "Co-Authored-By".
- Maíz de estilo: español rioplatense cavernícola para prose, inglés para tech terms.
- Path aliases: `@comms/mail/...`, `@infra/mailer/...`, `@src/...`.

---

## 1. Fase 1 — Branch + Scaffolding (commits chicos)

### Task 1.1: Branch desde `main`

```bash
cd /path/to/foundation
git checkout main
git pull --rebase
git checkout -b feat/maizzle-v6-tailwind-v4-vue-ssr
```

### Task 1.2: Bump deps + kill deps muertas

**Archivo**: `apps/back/package.json`

```diff
   "dependencies": {
-    "@maizzle/framework": "^5.0.8",
+    "@maizzle/framework": "^6.0.0",
+    "vue": "^3.5.0",
+    "@vue/compiler-ssr": "^3.5.0",
-    "handlebars": "4.7.8",
-    "tailwindcss-preset-email": "^1.4.0",
```

**Comando verificación**:

```bash
cd apps/back
pnpm install
pnpm ls @maizzle/framework handlebars vue | head
# Esperado: @maizzle/framework 6.x, handlebars = (empty), vue 3.x
```

**Commit**:

```bash
git add apps/back/package.json pnpm-lock.yaml
git commit -m "chore(deps): bump @maizzle/framework to v6, drop handlebars"
```

### Task 1.3: Eliminar config v5 obsoleta

**KILL**:
- `apps/back/tailwind.email.config.js`
- `apps/back/scripts/flatten-maizzle-output.js`
- `apps/back/src/modules/communications/mail/mail-templates/build/` (directorio entero, ya compilado)

**Comando**:

```bash
cd apps/back
git rm tailwind.email.config.js scripts/flatten-maizzle-output.js
rm -rf src/modules/communications/mail/mail-templates/build
```

**Verificación**:

```bash
ls apps/back/tailwind.email.config.js 2>&1
ls apps/back/scripts/flatten-maizzle-output.js 2>&1
ls apps/back/src/modules/communications/mail/mail-templates/build 2>&1
# Esperado: 3 líneas "No such file or directory"
```

**Commit**:

```bash
git add -A
git commit -m "chore(mail): remove v5 maizzle/tailwind config and compiled build dir"
```

---

## 2. Fase 2 — Maizzle v6 config + Tailwind v4 CSS

### Task 2.1: Crear `main.css` con Tailwind v4

**Archivo**: `apps/back/src/modules/communications/mail/mail-templates/css/main.css` (NEW)

```css
@import "@maizzle/tailwindcss";

@theme {
  /* Synced with apps/front/assets/css/tailwind.css (DaisyUI) */
  --color-primary-50: #f5f3ff;
  --color-primary-100: #ede9fe;
  --color-primary-200: #ddd6fe;
  --color-primary-300: #c4b5fd;
  --color-primary-400: #a78bfa;
  --color-primary-500: #8b5cf6;
  --color-primary-600: #7c3aed;
  --color-primary-700: #6d28d9;
  --color-primary-800: #5b21b6;
  --color-primary-900: #4c1d95;
}

@layer components {
  .email-container {
    max-width: 600px;
  }
  .email-card {
    border-radius: 0.75rem;
    overflow: hidden;
  }
}
```

**Verificación sintaxis**:

```bash
cd apps/back
npx tailwindcss -i src/modules/communications/mail/mail-templates/css/main.css -o /tmp/test-out.css --no-autoprefixer
# Esperado: archivo generado sin error, contiene las utility classes usadas en las plantillas
```

**Commit**:

```bash
git add apps/back/src/modules/communications/mail/mail-templates/css/main.css
git commit -m "feat(mail): tailwind v4 css-first config with synced primary palette"
```

### Task 2.2: Reescribir `maizzle.config.js` (v5 → v6)

**Archivo**: `apps/back/maizzle.config.js` (sobrescribir completo)

```js
const path = require('node:path');

/** @type {import('@maizzle/framework').Config} */
module.exports = {
  build: {
    content: [
      path.resolve(__dirname, 'src/modules/communications/mail/mail-templates/emails') + '/**/*.vue',
    ],
    // v6: no `output.path` — render es programático en runtime (MailerService).
  },
  css: {
    inline: true,
    purge: true,
    mailtrap: true,
  },
  prettify: true,
  minify: false,
  server: {
    port: 3001,
  },
};
```

**Verificación**:

```bash
cd apps/back
node -e "console.log(JSON.stringify(require('./maizzle.config.js').build.content, null, 2))"
# Esperado: array con path a emails/*.vue
```

**Commit**:

```bash
git add apps/back/maizzle.config.js
git commit -m "feat(mail): upgrade maizzle.config.js to v6 (vue sources, runtime render)"
```

### Task 2.3: Config TS para `defineConfig` compartido

**Archivo**: `apps/back/src/modules/communications/mail/mail-templates/config.ts` (NEW)

```ts
import { defineConfig } from '@maizzle/framework';

export const sharedConfig = defineConfig({
  build: {
    css: {
      inline: true,
      purge: true,
      mailtrap: true,
    },
  },
  cssPath: 'css/main.css',
});
```

**Commit**:

```bash
git add apps/back/src/modules/communications/mail/mail-templates/config.ts
git commit -m "feat(mail): shared maizzle defineConfig for runtime render"
```

---

## 3. Fase 3 — Port de plantillas (.hbs → .vue)

### Task 3.1: Layout `main.vue`

**Archivo**: `apps/back/src/modules/communications/mail/mail-templates/layouts/main.vue` (NEW)

```vue
<script setup>
defineProps<{
  app_url: string;
  app_name: string;
  title: string;
}>();
</script>

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>{{ title }}</title>
  </head>
  <body class="p-0 m-0 font-sans bg-indigo-50">
    <div class="px-4 py-12 mx-auto email-container">
      <div class="overflow-hidden bg-white rounded-xl shadow-md email-card">
        <div class="px-6 py-4 text-center bg-primary-600">
          <img
            :src="`${app_url}/assets/logo.svg`"
            :alt="app_name"
            class="mx-auto mt-4 w-auto h-14"
          />
        </div>

        <div class="p-8">
          <slot />
        </div>

        <div class="px-8 py-6 text-sm text-center text-gray-500 bg-gray-50">
          <p>&copy; {{ app_name }} - All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
</html>
```

**Commit**:

```bash
git add apps/back/src/modules/communications/mail/mail-templates/layouts/main.vue
git commit -m "feat(mail): port main layout to vue sfc (slot-based composition)"
```

### Task 3.2: Plantilla `activation.vue`

**Archivo**: `apps/back/src/modules/communications/mail/mail-templates/emails/activation.vue` (NEW)

```vue
<script setup>
import { sharedConfig } from '../config';
import Main from '../layouts/main.vue';

defineProps<{
  app_url: string;
  app_name: string;
  subject: string;
  greeting: string;
  body_text: string;
  button_text: string;
  ignore_text: string;
  link: string;
}>();
</script>

<template>
  <Main :app_url="app_url" :app_name="app_name" :title="subject">
    <div class="mb-8 text-center">
      <div class="inline-flex justify-center items-center mb-6 w-16 h-16 bg-primary-100 rounded-full">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
        </svg>
      </div>
      <h1 class="mb-3 text-3xl font-bold text-gray-800">{{ subject }}</h1>
    </div>

    <div class="mb-8 space-y-4 text-base text-gray-600">
      <p>{{ greeting }}</p>
      <p>{{ body_text }}</p>
    </div>

    <div class="my-8 text-center">
      <a :href="link" class="px-6 py-3 font-medium text-white bg-primary-600 rounded-lg shadow-md">
        {{ button_text }}
      </a>
    </div>

    <p class="text-sm text-gray-400">{{ ignore_text }}</p>
  </Main>
</template>
```

**Commit**:

```bash
git add apps/back/src/modules/communications/mail/mail-templates/emails/activation.vue
git commit -m "feat(mail): port activation template to vue sfc"
```

### Task 3.3: Plantilla `reset-password.vue`

**Archivo**: `apps/back/src/modules/communications/mail/mail-templates/emails/reset-password.vue` (NEW)

```vue
<script setup>
import Main from '../layouts/main.vue';

defineProps<{
  app_url: string;
  app_name: string;
  subject: string;
  greeting: string;
  body_text: string;
  button_text: string;
  ignore_text: string;
  link: string;
}>();
</script>

<template>
  <Main :app_url="app_url" :app_name="app_name" :title="subject">
    <div class="mb-8 text-center">
      <div class="inline-flex justify-center items-center mb-6 w-16 h-16 bg-primary-100 rounded-full">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
        </svg>
      </div>
      <h1 class="mb-3 text-3xl font-bold text-gray-800">{{ subject }}</h1>
    </div>

    <div class="mb-8 space-y-4 text-base text-gray-600">
      <p>{{ greeting }}</p>
      <p>{{ body_text }}</p>
    </div>

    <div class="my-8 text-center">
      <a :href="link" class="px-6 py-3 font-medium text-white bg-primary-600 rounded-lg shadow-md">
        {{ button_text }}
      </a>
    </div>

    <p class="text-sm text-gray-400">{{ ignore_text }}</p>
  </Main>
</template>
```

**Commit**:

```bash
git add apps/back/src/modules/communications/mail/mail-templates/emails/reset-password.vue
git commit -m "feat(mail): port reset-password template to vue sfc"
```

### Task 3.4: Plantilla `confirm-new-email.vue`

**Archivo**: `apps/back/src/modules/communications/mail/mail-templates/emails/confirm-new-email.vue` (NEW)

```vue
<script setup>
import Main from '../layouts/main.vue';

defineProps<{
  app_url: string;
  app_name: string;
  subject: string;
  greeting: string;
  body_text: string;
  button_text: string;
  link: string;
}>();
</script>

<template>
  <Main :app_url="app_url" :app_name="app_name" :title="subject">
    <div class="mb-8 text-center">
      <h1 class="mb-3 text-3xl font-bold text-gray-800">{{ subject }}</h1>
    </div>

    <div class="mb-8 space-y-4 text-base text-gray-600">
      <p>{{ greeting }}</p>
      <p>{{ body_text }}</p>
    </div>

    <div class="my-8 text-center">
      <a :href="link" class="px-6 py-3 font-medium text-white bg-primary-600 rounded-lg shadow-md">
        {{ button_text }}
      </a>
    </div>
  </Main>
</template>
```

**Commit**:

```bash
git add apps/back/src/modules/communications/mail/mail-templates/emails/confirm-new-email.vue
git commit -m "feat(mail): port confirm-new-email template to vue sfc"
```

### Task 3.5: KILL `.hbs` source

```bash
cd apps/back
git rm src/modules/communications/mail/mail-templates/emails/activation.hbs
git rm src/modules/communications/mail/mail-templates/emails/reset-password.hbs
git rm src/modules/communications/mail/mail-templates/emails/confirm-new-email.hbs
git rm src/modules/communications/mail/mail-templates/layouts/main.hbs
```

**Commit**:

```bash
git commit -m "chore(mail): remove legacy .hbs source templates"
```

---

## 4. Fase 4 — Runtime: `MailerService` con `Maizzle.render()`

### Task 4.1: Refactor `MailerService` (Handlebars → Maizzle)

**Archivo**: `apps/back/src/infrastructure/mailer/mailer.service.ts` (sobrescribir completo)

```ts
import { Injectable, Logger } from '@nestjs/common';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { render } from '@maizzle/framework';
import { AllConfigType } from '@src/config/config.type';
import { sharedConfig } from '@comms/mail/mail-templates/config';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly templatesRoot: string;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    this.transporter = nodemailer.createTransport({
      host: configService.get('mail.host', { infer: true }),
      port: configService.get('mail.port', { infer: true }),
      ignoreTLS: configService.get('mail.ignoreTLS', { infer: true }),
      secure: configService.get('mail.secure', { infer: true }),
      requireTLS: configService.get('mail.requireTLS', { infer: true }),
      auth: {
        user: configService.get('mail.user', { infer: true }),
        pass: configService.get('mail.password', { infer: true }),
      },
    });

    this.templatesRoot = path.join(
      configService.getOrThrow('app.workingDirectory', { infer: true }),
      'src',
      'modules',
      'communications',
      'mail',
      'mail-templates',
      'emails',
    );
  }

  async sendMail({
    templatePath,
    context,
    ...mailOptions
  }: nodemailer.SendMailOptions & {
    templatePath: string;
    context: Record<string, unknown>;
  }): Promise<void> {
    let html: string | undefined;

    context.app_url = this.configService.getOrThrow('app.backendDomain', {
      infer: true,
    });

    if (templatePath) {
      const templateName = path.basename(templatePath, path.extname(templatePath));
      const sourcePath = path.join(this.templatesRoot, `${templateName}.vue`);

      try {
        const result = await render(
          sourcePath,
          {
            ...context,
            ...sharedConfig,
          },
          {
            tailwind: {
              config: sharedConfig.cssPath,
            },
          },
        );
        html = typeof result === 'string' ? result : result.html;
      } catch (err) {
        this.logger.error(
          `Failed to render vue template ${templateName}: ${(err as Error).message}`,
        );
        throw err;
      }
    }

    await this.transporter.sendMail({
      ...mailOptions,
      from: mailOptions.from
        ? mailOptions.from
        : `"${this.configService.get('mail.defaultName', {
            infer: true,
          })}" <${this.configService.get('mail.defaultEmail', {
            infer: true,
          })}>`,
      html: mailOptions.html ? mailOptions.html : html,
      attachments: mailOptions.attachments || [],
    });
  }
}
```

**Verificación type-check**:

```bash
cd apps/back
pnpm check-types
# Esperado: 0 errors
```

**Commit**:

```bash
git add apps/back/src/infrastructure/mailer/mailer.service.ts
git commit -m "refactor(mail): render vue sfc templates via @maizzle/framework at runtime"
```

### Task 4.2: Update `mail-template-path.helper.ts`

**Archivo**: `apps/back/src/modules/communications/mail/helpers/mail-template-path.helper.ts`

```ts
import path from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { AllConfigType } from '@src/config/config.type';

let configService: ConfigService<AllConfigType>;

export function initMailTemplatePath(cs: ConfigService<AllConfigType>): void {
  configService = cs;
}

function getWorkingDirectory(): string {
  if (!configService) {
    throw new Error(
      'Mail template path helper not initialized. Call initMailTemplatePath() in MailModule.',
    );
  }
  return configService.getOrThrow('app.workingDirectory', { infer: true });
}

/**
 * Resuelve la ruta absoluta a un template fuente Vue (.vue) en emails/.
 * Maizzle v6 renderiza directamente desde la source — sin build step.
 */
export function getMailTemplatePath(...segments: string[]): string {
  return path.join(
    getWorkingDirectory(),
    'src',
    'modules',
    'communications',
    'mail',
    'mail-templates',
    'emails',
    ...segments,
  );
}

/** KEEP: helper de source paths (no se rompe, sigue apuntando a emails/). */
export function getMailSourcePath(...segments: string[]): string {
  return path.join(
    getWorkingDirectory(),
    'src',
    'modules',
    'communications',
    'mail',
    'mail-templates',
    'emails',
    ...segments,
  );
}
```

**Commit**:

```bash
git add apps/back/src/modules/communications/mail/helpers/mail-template-path.helper.ts
git commit -m "refactor(mail): template path helper points to .vue sources (no build dir)"
```

### Task 4.3: Update package.json scripts

**Archivo**: `apps/back/package.json`

```diff
-    "maizzle:serve": "maizzle serve",
-    "maizzle:build": "maizzle build && node ./scripts/flatten-maizzle-output.js"
+    "maizzle:serve": "maizzle serve"
```

> `maizzle:build` se elimina — v6 renderiza en runtime, no hay build step.

**Commit**:

```bash
git add apps/back/package.json
git commit -m "chore(mail): remove obsolete maizzle:build script (v6 is runtime-only)"
```

---

## 5. Fase 5 — Tests + Verificación

### Task 5.1: Update tests existentes que referencien `.hbs`

```bash
cd apps/back
grep -rln "templatePath.*hbs\|hbs.*template" test/ src/ 2>/dev/null
```

Si hay matches, reemplazar `.hbs` → `.vue` en los test fixtures y mocks.

### Task 5.2: Smoke test — render manual

**Crear**: `apps/back/test/mail/mailer.service.spec.ts` (NEW o actualizar existente)

```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@infra/mailer/mailer.service';
import { render } from '@maizzle/framework';
import fs from 'node:fs/promises';

jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: jest.fn().mockResolvedValue({ messageId: 'mock' }) }),
}));

jest.mock('@maizzle/framework', () => ({
  render: jest.fn(),
}));

describe('MailerService — Vue SSR', () => {
  let service: MailerService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MailerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const map: Record<string, unknown> = {
                'mail.host': 'localhost',
                'mail.port': 1025,
                'mail.ignoreTLS': true,
                'mail.secure': false,
                'mail.requireTLS': false,
                'mail.user': '',
                'mail.password': '',
                'mail.defaultName': 'Test',
                'mail.defaultEmail': 'test@test.local',
                'app.backendDomain': 'http://localhost:3000',
                'app.workingDirectory': process.cwd(),
              };
              return map[key];
            }),
            getOrThrow: jest.fn().mockImplementation((key: string) => {
              const map: Record<string, string> = {
                'app.backendDomain': 'http://localhost:3000',
                'app.workingDirectory': process.cwd(),
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(MailerService);
  });

  it('renders vue template via maizzle.render()', async () => {
    (render as jest.Mock).mockResolvedValue('<html>mocked</html>');

    await service.sendMail({
      to: 'user@test.local',
      subject: 'Test',
      templatePath: 'activation.vue',
      context: { hash: 'abc', user: { firstName: 'Adrián', language: 'en' } },
    } as any);

    expect(render).toHaveBeenCalledWith(
      expect.stringContaining('activation.vue'),
      expect.objectContaining({ hash: 'abc' }),
      expect.any(Object),
    );
  });

  it('throws if template render fails', async () => {
    (render as jest.Mock).mockRejectedValue(new Error('compile error'));

    await expect(
      service.sendMail({
        to: 'user@test.local',
        subject: 'Test',
        templatePath: 'missing.vue',
        context: {},
      } as any),
    ).rejects.toThrow('compile error');
  });
});
```

**Verificación**:

```bash
cd apps/back
pnpm test -- mailer.service.spec.ts
# Esperado: 2 passed
```

**Commit**:

```bash
git add apps/back/test/mail/mailer.service.spec.ts
git commit -m "test(mail): unit tests for vue sfc render via maizzle v6"
```

### Task 5.3: E2E render real (no mock)

**Crear**: `apps/back/test/mail/render-integration.spec.ts` (NEW)

```ts
import path from 'node:path';
import { render } from '@maizzle/framework';
import { sharedConfig } from '@comms/mail/mail-templates/config';

describe('Maizzle v6 — real render integration', () => {
  it('compiles activation.vue to inlined HTML', async () => {
    const sourcePath = path.join(
      process.cwd(),
      'src/modules/communications/mail/mail-templates/emails/activation.vue',
    );

    const result = await render(sourcePath, {
      app_url: 'http://localhost:3000',
      app_name: 'Foundation',
      subject: 'Confirm your email',
      greeting: 'Hi Adrián,',
      body_text: 'Click below to confirm.',
      button_text: 'Confirm',
      ignore_text: 'If you did not sign up, ignore this email.',
      link: 'http://localhost:3000/confirm-email?hash=abc',
    });

    const html = typeof result === 'string' ? result : result.html;
    expect(html).toMatch(/<html/);
    expect(html).toMatch(/style="[^"]*background-color/i); // tailwind inlined
    expect(html).toContain('Confirm your email');
    expect(html).toContain('http://localhost:3000/confirm-email?hash=abc');
  }, 30_000);
});
```

**Verificación**:

```bash
cd apps/back
pnpm test -- render-integration.spec.ts
# Esperado: 1 passed, con estilos inline en el output
```

**Commit**:

```bash
git add apps/back/test/mail/render-integration.spec.ts
git commit -m "test(mail): integration test for maizzle v6 vue sfc compilation"
```

### Task 5.4: Smoke test con Mailpit

```bash
# Terminal 1
cd apps/back
docker run -d --name mailpit-test -p 1025:1025 -p 8025:8025 axllent/mailpit

# Terminal 2
cd apps/back
cp .env.local.template .env
# editar .env: MAIL_HOST=localhost, MAIL_PORT=1025, MAIL_IGNORE_TLS=true

pnpm dev
```

Disparar un endpoint de auth (signup o forgot password) → revisar en `http://localhost:8025` que el HTML sale con estilos inline y el link correcto.

**Verificación manual**:

- [ ] Email llega a Mailpit.
- [ ] HTML tiene `style="..."` en elementos (no clases sueltas).
- [ ] Colores OKLCH convertidos a HEX (v6 lo hace automático).
- [ ] REM convertido a PX en el output.
- [ ] Links funcionan (no están vacíos).
- [ ] Plaintext fallback (`text:` en mailOptions) sigue presente.

```bash
docker rm -f mailpit-test
```

---

## 6. Fase 6 — Docs

### Task 6.1: Update `docs/modules/email.md`

**Cambios concretos**:

1. Reemplazar la sección "Email Templates (Maizzle)" — eliminar referencia a `tailwind.email.config.js` (muerto), actualizar "Build Command" (ya no hay build), actualizar "Template Conventions" (`.hbs` → `.vue`).
2. Actualizar "Creating a New Template" — port del ejemplo HBS a Vue SFC.
3. Actualizar "Adding a New Email Type" — `getMailTemplatePath('my-template.vue')` en vez de `.hbs`.

**Commit**:

```bash
git add apps/back/docs/email-development.md docs/modules/email.md
git commit -m "docs(mail): update email module docs for maizzle v6 + vue sfc"
```

### Task 6.2: Update `apps/back/docs/email-development.md`

Mismo criterio. Sección "How to add a new email" con ejemplo Vue.

**Commit**:

```bash
git add apps/back/docs/email-development.md
git commit -m "docs(mail): port email-development guide to vue sfc workflow"
```

---

## 7. Fase 7 — Lint + Final commit

### Task 7.1: Lint completo

```bash
cd apps/back
pnpm lint
pnpm format
pnpm check-types
```

**Esperado**: 0 errors, 0 warnings. Si eslint marca imports sin usar (ej. `Handlebars` en `MailerService` ya no está), se auto-fixean.

### Task 7.2: Verificación final grep

```bash
cd apps/back
grep -rn "handlebars\|\.hbs" --include="*.ts" src/ test/ 2>/dev/null
# Esperado: sin matches (excepto comentarios históricos si los hay)
grep -rn "tailwindcss-preset-email" --include="*.{ts,js,json}" . 2>/dev/null
# Esperado: sin matches
```

### Task 7.3: Push + PR

```bash
git push -u origin feat/maizzle-v6-tailwind-v4-vue-ssr
gh pr create \
  --title "feat(mail): maizzle v6 + tailwind v4 + vue sfc (kill handlebars)" \
  --body "Closes #81

- Bump @maizzle/framework 5 → 6 (Vite native, CSS-first)
- Drop handlebars runtime + tailwindcss-preset-email
- Tailwind v4 via @theme in main.css
- Templates ported from .hbs to .vue SFC
- MailerService.render() uses @maizzle/framework programatic API
- Runtime render (no build step)
- Updated email module docs

Verification:
- pnpm check-types: clean
- pnpm test mailer.service.spec.ts: 2 passed
- pnpm test render-integration.spec.ts: 1 passed
- pnpm lint: clean
- Manual smoke with Mailpit: HTML arrives with inline styles, links intact"
```

---

## 8. Riesgos y rollback

### Riesgos

| Riesgo | Mitigación |
|---|---|
| `render()` de Maizzle 6 tiene API distinta a v5 (signature, return type) | Task 4.1 incluye test integración con render real (5.3). Validar signature en docs de Maizzle 6 antes de implementar. |
| `@theme` en v4 cambia nombres de utilities (`bg-primary-600` sigue OK, pero `text-gray-800` puede haber cambiado) | Task 3.x mantiene mismas clases que el HBS actual. Task 5.4 verifica con Mailpit real. |
| Vue SSR pesado en cold start (cada email renderiza Vue) | Mitigación: `sharedConfig` cachea, Vue SSR es cheap. Si es problema, mover render a worker (ya hay BullMQ). Out of scope pa este PR. |
| Tests existentes que importan Handlebars no compilan | Task 5.1 hace grep + update antes de los tests. Si hay tests E2E que tocan el path `build/`, ajustar fixtures. |
| `pnpm install` rompe por peer deps de Vue | Task 1.2 marca versiones exactas (`^3.5.0`). Si hay conflicto, usar `--legacy-peer-deps` solo como último recurso y documentar. |

### Rollback

Si algo se rompe post-merge:

1. `git revert <merge-sha>` — vuelve al estado anterior (HBS + Handlebars + Maizzle v5).
2. O cherry-pick revert solo de los commits de Fase 4 (runtime changes) — mantiene dependencias nuevas pero vuelve a HBS. Menos invasivo.

---

## 9. Checklist final pre-PR

- [ ] Branch `feat/maizzle-v6-tailwind-v4-vue-ssr` desde `main` actualizado.
- [ ] Commits atómicos (uno por task, conventional commits).
- [ ] Cero referencias a `.hbs` / `handlebars` / `tailwindcss-preset-email` en código.
- [ ] `pnpm install` limpio.
- [ ] `pnpm check-types` 0 errors.
- [ ] `pnpm lint` 0 errors.
- [ ] `pnpm test` verde (unit + integration).
- [ ] `pnpm format` aplicado.
- [ ] Smoke test con Mailpit OK (HTML inline, links correctos).
- [ ] Docs actualizadas (`email.md`, `email-development.md`).
- [ ] PR abierto con `--body` enlazando `#81`.

---

## 10. Resumen de archivos

### Crear (5)

- `apps/back/src/modules/communications/mail/mail-templates/css/main.css`
- `apps/back/src/modules/communications/mail/mail-templates/config.ts`
- `apps/back/src/modules/communications/mail/mail-templates/layouts/main.vue`
- `apps/back/src/modules/communications/mail/mail-templates/emails/activation.vue`
- `apps/back/src/modules/communications/mail/mail-templates/emails/reset-password.vue`
- `apps/back/src/modules/communications/mail/mail-templates/emails/confirm-new-email.vue`
- `apps/back/test/mail/render-integration.spec.ts`

### Modificar (4)

- `apps/back/package.json`
- `apps/back/maizzle.config.js`
- `apps/back/src/infrastructure/mailer/mailer.service.ts`
- `apps/back/src/modules/communications/mail/helpers/mail-template-path.helper.ts`
- `docs/modules/email.md`
- `apps/back/docs/email-development.md`

### Borrar (5)

- `apps/back/tailwind.email.config.js`
- `apps/back/scripts/flatten-maizzle-output.js`
- `apps/back/src/modules/communications/mail/mail-templates/build/` (dir)
- `apps/back/src/modules/communications/mail/mail-templates/emails/activation.hbs`
- `apps/back/src/modules/communications/mail/mail-templates/emails/reset-password.hbs`
- `apps/back/src/modules/communications/mail/mail-templates/emails/confirm-new-email.hbs`
- `apps/back/src/modules/communications/mail/mail-templates/layouts/main.hbs`

Total: **18 archivos tocados, 13 commits** (uno por task), **1 PR** cerrando #81.
