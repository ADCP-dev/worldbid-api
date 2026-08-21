---
doc: agent-native/03-auto-generated-skills
title: "Skills Auto-Generados por Extensión"
status: draft
created: 2026-08-19
priority: P1
---

# PRD 03 — Skills Auto-Generados por Extensión

## Objetivo

Cada extensión de Foundation genera automáticamente un skill markdown que un agente de coding puede cargar para entender cómo operar esa extensión sin explorar el código. Esto elimina el onboarding manual: instalas una extensión y el agente ya sabe usarla.

## Problema actual

Foundation tiene `.agents/skills/` con skills manuales. Cuando añades una extensión nueva a un proyecto, el agente necesita:

1. Leer el spec YAML para entender entidades y permisos
2. Leer los handlers para entender lógica de negocio
3. Leer el manifest para entender rutas
4. Leer el frontend layer para entender páginas

Si el agente no hace todo esto, opera a ciegas y rompe cosas. Hoy esto se resuelve con AGENTS.md (51KB) que es estático y genérico, no específico por extensión.

## Diseño

### Relación con MCP (PRD 02)

El MCP introspection server (PRD 02) y los skills auto-generados (este PRD) sirven propósitos distintos:

- **MCP**: consultas dinámicas en tiempo real. El agente llama `foundation.get_resource` cuando necesita detalle exacto de un recurso. Consume tokens por cada llamada.
- **Skills**: contexto estático que el agente carga una vez al inicio. Es un resumen compacto que le da al agente el panorama general sin necesidad de llamar al MCP repetidamente.

No se duplican. El skill dice "el recurso task tiene campos title, status, assigneeId, permissions admin/user/manager, hooks beforeCreate/afterCreate". El MCP dice "dame el detalle exacto del campo assigneeId incluyendo su validación, tipo de ref, y onDelete". El skill es el índice; el MCP es la enciclopedia.

### Skill auto-generado

Cada extensión genera un archivo `skill.md` en `.agents/skills/foundation-ext-<name>.md`:

```markdown
# Skill: Foundation Extension — Tasks

## Cuándo usar

Cuando trabajes en código relacionado con tasks, task-comments, task-attachments,
jobs de stale detection, o webhooks de tasks.

## Estructura

Extension: tasks (v2.0.0)
Spec-driven: sí
Recursos: task, task-comment, task-attachment
Roles custom: manager

### Recurso: task

Tabla: ext_tasks_task
Soft delete: sí
Timestamps: sí

Campos:
- title (string, required, 2-200 chars)
- description (text, nullable)
- status (enum: pending|in_progress|review|done|blocked, default: pending)
- priority (enum: low|medium|high|urgent, default: medium)
- assigneeId (ref → user, nullable, SET NULL on delete)
- reporterId (ref → user, nullable, SET NULL on delete)
- dueDate (datetime, nullable)
- position (integer, default: 0) — solo admin/manager pueden leer/escribir
- apiKey (password, nullable) — solo admin puede leer/escribir
- attachment (file, local, pdf|txt)
- coverImage (file, local, png|jpeg|webp)

Permisos:
- list: admin, user, manager
- read: admin, user, manager
- create: admin, manager
- update: admin, user, manager
- delete: admin
- rowLevel user: assigneeId == ${user.id}
- rowLevel manager: assigneeId == ${user.id}

Hooks:
- beforeCreate: extensions/tasks/hooks/task-before-create.ts
- afterCreate: extensions/tasks/hooks/task-after-create.ts
- afterUpdate: extensions/tasks/hooks/task-after-update.ts

Actions:
- stats (GET stats): admin, user, manager
- assign (POST :id/assign): admin, manager — input: assigneeId (ref user, required)
- reorder (POST reorder): admin, manager — input: items (json, required)
- bulk-status (POST bulk/status): admin, manager — input: taskIds (json), status (enum)

Jobs:
- stale-tasks-detector: interval 60s, retries 3, exponential backoff

Notifications:
- task-assigned: email tras afterCreate cuando assigneeId != null
- task-overdue: email tras job stale-tasks-detector

Webhooks:
- stale (POST tasks/webhooks/stale, HMAC auth)

### Recurso: task-comment
[...]

## Cómo crear un task

POST /api/v1/tasks
Body: { title: string, status?: enum, assigneeId?: number, ... }
Permisos: admin, manager
Hooks ejecutados: beforeCreate, afterCreate
Notificaciones: task-assigned si assigneeId presente

## Cómo asignar un task

POST /api/v1/tasks/:id/assign
Body: { assigneeId: number }
Permisos: admin, manager
Handler: extensions/tasks/actions/assign.handler.ts

## Errores comunes

- assigneeId null en hook beforeCreate: añadir null check o marcar required en spec
- position sin permiso: solo admin/manager pueden escribir position
- apiKey visible para user: field-level permission bloquea, solo admin ve apiKey

## Frontend

Nuxt layer: modules/tasks/
Páginas: tasks/index.vue (kanban), tasks/[id].vue (detail)
Store: stores/tasks.ts
Composable: useTasks.ts
```

### Generador

```
apps/back/src/core/spec-engine/
└── skill-generator.ts
```

El `SkillGenerator` lee el spec parseado (que ya está en memoria en `SpecLoader`) y produce markdown.

**Consideración: escritura en container Docker**

El backend corre en un container Docker donde el filesystem es efímero. Escribir `.agents/skills/` desde dentro del container no persiste entre restarts y no es visible para el agente que opera en el host.

Solución: el skill generator se ejecuta como **comando CLI desde el host**, no desde dentro del container:

```bash
# Desde el host, en la raíz del repo
pnpm spec:generate-skills
```

Esto lee los spec YAML directamente del filesystem del host y escribe los skills en `.agents/skills/` del repo. El agente (Cursor, Claude Code) que opera en el host ve los archivos inmediatamente.

La generación automática en boot (dentro del container) se mantiene como **opcional** para desarrollo local (cuando se corre sin Docker):

```typescript
// spec-engine-boot.ts (extender)
async function bootSpecEngine(module: DynamicModule) {
  const loader = new SpecLoader();
  await loader.load();

  // Solo generar skills si NO estamos en Docker (filesystem efímero)
  // y GENERATE_SKILLS no está deshabilitado
  if (process.env.GENERATE_SKILLS !== 'false' && !process.env.CONTAINER_ENV) {
    const skillGen = new SkillGenerator(loader);
    skillGen.generateAll();
    logger.log(`Generated ${loader.getExtensions().length} extension skills`);
  }
}
```

En producción (Docker), los skills se generan en CI/CD antes del build:

```yaml
# .github/workflows/ci.yml (añadir step)
- name: Generate Foundation skills
  run: pnpm spec:generate-skills

- name: Commit skills
  run: |
    git add .agents/skills/
    git diff --staged --quiet || git commit -m "chore: auto-generate extension skills"
```

```typescript
// skill-generator.ts (esqueleto)
export class SkillGenerator {
  constructor(private specLoader: SpecLoader) {}

  generateAll(): void {
    const extensions = this.specLoader.getExtensions();
    for (const ext of extensions) {
      const markdown = this.generateExtensionSkill(ext);
      const path = `.agents/skills/foundation-ext-${ext.name}.md`;
      writeFileSync(path, markdown);
    }
  }

  private generateExtensionSkill(ext: ExtensionSpec): string {
    const lines: string[] = [];
    lines.push(`# Skill: Foundation Extension — ${ext.displayName || ext.name}`);
    lines.push('');
    lines.push('## Cuándo usar');
    lines.push('');
    lines.push(`Cuando trabajes en código relacionado con ${ext.name},`);
    lines.push(`sus recursos, hooks, jobs, notificaciones, o webhooks.`);
    lines.push('');
    lines.push('## Estructura');
    lines.push('');
    lines.push(`Extension: ${ext.name} (v${ext.version})`);
    lines.push(`Spec-driven: sí`);
    lines.push(`Recursos: ${ext.resources.map(r => r.name).join(', ')}`);
    if (ext.roles && ext.roles.length > 0) {
      lines.push(`Roles custom: ${ext.roles.map(r => r.name).join(', ')}`);
    }
    lines.push('');

    for (const resource of ext.resources) {
      lines.push(this.generateResourceSection(resource, ext));
    }

    lines.push('');
    lines.push('## Errores comunes');
    lines.push(this.generateCommonErrors(ext));

    if (this.hasFrontendLayer(ext)) {
      lines.push('');
      lines.push('## Frontend');
      lines.push(this.generateFrontendSection(ext));
    }

    return lines.join('\n');
  }

  private generateResourceSection(resource: ResourceSpec, ext: ExtensionSpec): string {
    // Genera la sección "### Recurso: task" con fields, permissions, hooks, etc.
    // Lee del ResourceSpec que ya está parseado
    ...
  }
}
```

### Integración con spec engine boot

En `spec-engine-boot.ts`, después de cargar specs:

```typescript
// spec-engine-boot.ts (extender)
async function bootSpecEngine(module: DynamicModule) {
  const loader = new SpecLoader();
  await loader.load();          // ya existe
  // ... registrar entidades, controllers, etc. ...

  // NUEVO: generar skills
  if (process.env.GENERATE_SKILLS !== 'false') {
    const skillGen = new SkillGenerator(loader);
    skillGen.generateAll();
    logger.log(`Generated ${loader.getExtensions().length} extension skills`);
  }
}
```

### Para extensiones tradicionales (no spec-driven)

Las extensiones tradicionales (CRM, CMS, Stripe) no tienen spec YAML. El skill se genera desde el `extension.manifest.ts` + escaneo de controllers:

```typescript
// Para extensions tradicionales, el skill generator usa:
// 1. extension.manifest.ts → routes, entities, menuItems
// 2. Escaneo de controllers → métodos, guards, DTOs
// 3. Escaneo de entities → columnas, relations

export class TraditionalSkillGenerator {
  generate(manifest: ExtensionManifest, extensionDir: string): string {
    // Lee manifest, escanea controllers con reflection de NestJS metadata
    // Produce markdown con misma estructura que spec-driven skills
  }
}
```

### Comando CLI

```bash
# Regenerar todos los skills
pnpm spec:generate-skills

# Regenerar solo una extensión
pnpm spec:generate-skills -- --extension=tasks

# Watch mode (regenera cuando spec YAML cambia)
pnpm spec:generate-skills -- --watch
```

Añadir a `package.json`:

```json
{
  "scripts": {
    "spec:generate-skills": "ts-node apps/back/src/core/spec-engine/skill-generator-cli.ts"
  }
}
```

### Integración con AGENTS.md

El AGENTS.md actual tiene una sección de skills que se actualiza manual. Con skills auto-generados, el AGENTS.md debe:

1. Referenciar los skills auto-generados (no duplicarlos)
2. Mantener solo las instrucciones genéricas de Foundation (reglas, personalidad, SDD)
3. Los skills por extensión viven en `.agents/skills/foundation-ext-*.md` y se auto-descubren

## Criterios de aceptación

1. Cada extensión spec-driven genera un skill en `.agents/skills/foundation-ext-<name>.md`
2. Cada extensión tradicional genera un skill desde su manifest
3. El skill incluye: recursos, campos con tipos, permisos, hooks, actions, jobs, notificaciones, webhooks
4. El skill incluye errores comunes inferidos del spec
5. `pnpm spec:generate-skills` regenera todos los skills
6. Los skills se generan automáticamente al bootear el spec engine (a menos que GENERATE_SKILLS=false)
7. Los skills no duplican AGENTS.md — complementan
8. Un agente que carga un skill puede operar la extensión sin leer código adicional

## Dependencias

- Sin dependencias externas nuevas
- Lee del SpecLoader (ya existe)
- Escribe archivos con fs (ya usado)

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Skills desactualizados si spec cambia y no se regenera | Watch mode + auto-gen en boot |
| Skills demasiado largos consumen tokens | Solo incluir información accionable; referir a MCP para detalle completo |
| Extensiones tradicionales sin reflection suficiente | Escaneo de decorators NestJS con TypeScript compiler API |