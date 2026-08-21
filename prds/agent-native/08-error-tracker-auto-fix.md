---
doc: agent-native/08-error-tracker-auto-fix
title: "Error Tracker → Auto-Fix de Bugs"
status: draft
created: 2026-08-19
priority: P1
---

# PRD 08 — Error Tracker → Auto-Fix de Bugs

## Objetivo

El error tracker actual deduplica y persiste errores. El siguiente paso es que el sistema proponga fixes automáticamente y, cuando la confianza sea alta, los aplique sin intervención humana. Esto es el diferenciador técnico de Foundation: no solo trackea errores, los arregla.

## Problema actual

`ErrorTrackerService` recibe errores, los deduplica por hash, y los persiste. `SpecErrorReporter` abre issues de GitHub en la primera ocurrencia. Pero el flujo termina ahí: un humano tiene que leer el error, diagnosticar, escribir fix, testear, y deployar.

Con el PRD 01 (Structured Actionable Errors), el sistema ya propone un `suggestedFix`. Este PRD lleva esa sugerencia a ejecución: el sistema genera el fix, lo testea, y lo aplica.

## Diseño

### Arquitectura

```
Error ocurre
    │
    ▼
SpecErrorReporter.report()
    │
    ▼
ActionableError (con suggestedFix) — PRD 01
    │
    ▼
AutoFixEngine.evalúa(error)
    │
    ├─ confidence: low → solo reporta (humano decide)
    ├─ confidence: medium → genera PR draft para revisión
    └─ confidence: high → aplica fix + testa + auto-deploya
```

### AutoFixEngine

```typescript
// core/auto-fix/auto-fix-engine.ts

export interface AutoFixResult {
  errorId: string;
  status: 'skipped' | 'pr_created' | 'applied' | 'failed';
  confidence: 'low' | 'medium' | 'high';
  fixType: SuggestedFix['type'];
  changes: FileChange[];
  prUrl?: string;
  testResult?: TestResult;
  reason?: string;           // si skipped o failed
}

export interface FileChange {
  file: string;
  before: string;
  after: string;
  diff: string;
}

export interface TestResult {
  passed: boolean;
  output: string;
  duration: number;
}

@Injectable()
export class AutoFixEngine {
  constructor(
    private errorTrackerService: ErrorTrackerService,
    private specLoader: SpecLoader,
    private configService: ConfigService,
  ) {}

  async evaluate(error: ActionableError): Promise<AutoFixResult> {
    const fix = error.suggestedFix;
    if (!fix) {
      return { errorId: error.id, status: 'skipped', confidence: 'low',
        fixType: 'manual', changes: [], reason: 'No suggested fix available' };
    }

    // ─── 1. Generar cambios ───
    const changes = await this.generateChanges(error, fix);
    if (changes.length === 0) {
      return { errorId: error.id, status: 'skipped', confidence: fix.confidence,
        fixType: fix.type, changes: [], reason: 'Could not generate file changes' };
    }

    // ─── 2. Testear en branch aislado (PRD 04) ───
    const testResult = await this.testChanges(changes, error);

    if (!testResult.passed) {
      return { errorId: error.id, status: 'failed', confidence: fix.confidence,
        fixType: fix.type, changes, testResult,
        reason: 'Tests failed after applying fix' };
    }

    // ─── 3. Aplicar según confianza ───
    switch (fix.confidence) {
      case 'high':
        return await this.applyFix(error, changes, testResult);
      case 'medium':
        return await this.createDraftPR(error, changes, testResult);
      case 'low':
        return { errorId: error.id, status: 'skipped', confidence: 'low',
          fixType: fix.type, changes, testResult,
          reason: 'Low confidence fix — manual review required' };
    }
  }

  private async generateChanges(error: ActionableError, fix: SuggestedFix): Promise<FileChange[]> {
    // ─── Generar cambios según tipo de fix ───
    switch (fix.type) {
      case 'spec_fix':
        return await this.generateSpecFix(error, fix);
      case 'code_fix':
        return await this.generateCodeFix(error, fix);
      case 'data_fix':
        return await this.generateDataFix(error, fix);
      case 'config_fix':
        return await this.generateConfigFix(error, fix);
      default:
        return [];
    }
  }

  private async generateSpecFix(error: ActionableError, fix: SuggestedFix): Promise<FileChange[]> {
    // Ej: "Marcar assigneeId como required en spec"
    // Lee el spec YAML, modifica el campo, devuelve diff
    const specPath = fix.targetSpec;
    const specContent = readFileSync(specPath, 'utf8');
    const modified = this.applySpecModification(specContent, fix);
    return [{
      file: specPath,
      before: specContent,
      after: modified,
      diff: this.computeDiff(specContent, modified),
    }];
  }

  private async generateCodeFix(error: ActionableError, fix: SuggestedFix): Promise<FileChange[]> {
    // Ej: "Añadir null check en handler"
    const handlerPath = fix.targetFile;
    const code = readFileSync(handlerPath, 'utf8');
    const modified = this.applyCodeModification(code, error, fix);
    return [{
      file: handlerPath,
      before: code,
      after: modified,
      diff: this.computeDiff(code, modified),
    }];
  }

  private async testChanges(changes: FileChange[], error: ActionableError): Promise<TestResult> {
    // 1. Verificar que el working tree está limpio
    try {
      execSync('git diff --quiet HEAD');
    } catch {
      return { passed: false, output: 'Working tree is not clean — cannot test auto-fix', duration: 0 };
    }

    // 2. Crear DB branch (PRD 04)
    const branch = await this.branchManager.createBranch({ copyData: true });

    // 3. Aplicar cambios en archivos
    for (const change of changes) {
      writeFileSync(change.file, change.after);
    }

    // 4. Aplicar migration en branch si es spec_fix (crea/alter table)
    // 5. Bootear spec engine contra branch y verificar que carga sin errores
    // 6. Correr tests
    const startTime = Date.now();
    try {
      // Primero verificar que el spec engine carga con los cambios
      execSync('pnpm spec:validate --strict', { encoding: 'utf8', timeout: 15000 });

      // Luego correr tests del spec engine + extensión afectada
      const testFilter = error.extension ? `--filter=${error.extension}` : '--filter=spec-engine';
      const output = execSync(`pnpm test ${testFilter}`, {
        encoding: 'utf8',
        timeout: 120000,  // 2 minutos max
      });
      return { passed: true, output, duration: Date.now() - startTime };
    } catch (e) {
      return { passed: false, output: e.stdout || e.stderr || e.message, duration: Date.now() - startTime };
    } finally {
      // 7. Siempre limpiar: descartar branch + revertir archivos
      try {
        await this.branchManager.discardBranch(branch);
      } catch (e) {
        this.logger.error(`Failed to discard branch ${branch.name}: ${e.message}`);
      }
      for (const change of changes) {
        try {
          writeFileSync(change.file, change.before);
        } catch (e) {
          this.logger.error(`Failed to revert ${change.file}: ${e.message}`);
        }
      }
      // Verificar que el working tree volvió a estar limpio
      try {
        execSync('git diff --quiet HEAD');
      } catch {
        this.logger.error('Working tree is dirty after test — manual cleanup needed');
      }
    }
  }

  private async applyFix(error: ActionableError, changes: FileChange[], testResult: TestResult): Promise<AutoFixResult> {
    // 1. Verificar working tree limpio antes de aplicar
    try {
      execSync('git diff --quiet HEAD');
    } catch {
      return { errorId: error.id, status: 'failed', confidence: 'high',
        fixType: error.suggestedFix.type, changes, testResult,
        reason: 'Working tree is not clean — cannot apply fix' };
    }

    // 2. Aplicar cambios permanentemente
    for (const change of changes) {
      writeFileSync(change.file, change.after);
    }

    // 3. Si el fix es un spec_fix, generar la migration correspondiente
    if (error.suggestedFix.type === 'spec_fix') {
      try {
        execSync('pnpm migration:generate AutoFixSpecChange', { encoding: 'utf8', timeout: 30000 });
      } catch (e) {
        // Si la migration no se puede generar, revertir y fallar
        for (const change of changes) {
          writeFileSync(change.file, change.before);
        }
        return { errorId: error.id, status: 'failed', confidence: 'high',
          fixType: 'spec_fix', changes, testResult,
          reason: `Migration generation failed: ${e.message}` };
      }
    }

    // 4. Marcar error como resuelto
    await this.errorTrackerService.markAsResolved(error.id);

    // 5. Recargar spec engine para que los cambios surtan efecto
    //    Si la app está corriendo, el spec engine se recarga.
    //    Si no está corriendo, los cambios se aplican en el próximo boot.
    try {
      await this.specEngineReload();
    } catch (e) {
      // Si el reload falla, el fix se aplicó pero la app no se actualizó.
      // Loguear pero no revertir — el próximo boot cargará el spec corregido.
      this.logger.warn(`Spec engine reload failed after auto-fix: ${e.message}. Changes will take effect on next boot.`);
    }

    // 6. Opcional: commit + deploy
    if (this.configService.get('AUTO_FIX_AUTO_COMMIT') === 'true') {
      execSync(`git add -A && git commit -m "fix(auto): ${error.category} in ${error.extension}/${error.resource} — ${error.id}"`);
    }

    return {
      errorId: error.id,
      status: 'applied',
      confidence: 'high',
      fixType: error.suggestedFix.type,
      changes,
      testResult,
    };
  }

  private async createDraftPR(error: ActionableError, changes: FileChange[], testResult: TestResult): Promise<AutoFixResult> {
    // Crear branch git, commitear, abrir PR draft
    const branchName = `fix/auto-${error.id.slice(0, 8)}`;
    execSync(`git checkout -b ${branchName}`);
    for (const change of changes) {
      writeFileSync(change.file, change.after);
    }
    execSync(`git add -A && git commit -m "fix(auto): ${error.category} in ${error.extension}/${error.resource} — ${error.id}"`);
    execSync(`git push origin ${branchName}`);
    const prUrl = execSync(`gh pr create --draft --title "Auto-fix: ${error.message}" --body "..."`, { encoding: 'utf8' }).trim();

    return {
      errorId: error.id,
      status: 'pr_created',
      confidence: 'medium',
      fixType: error.suggestedFix.type,
      changes,
      testResult,
      prUrl,
    };
  }
}
```

### Tipos de fix que puede generar

#### spec_fix (confidence: high generalmente)

1. **Campo null que debería ser required**: Si un hook asume que un campo existe y llega null, el fix es marcar `required: true` en el spec.

2. **Permiso faltante**: Si `permission_denied` y el usuario debería poder acceder, el fix es añadir el rol a `permissions.<op>`.

3. **Campo sin validación**: Si `validation` error, el fix es añadir constraints al campo.

```yaml
# Antes
- name: email
  type: string

# Después (auto-fix)
- name: email
  type: string
  validation:
    email: true
```

#### code_fix (confidence: low-medium generalmente)

1. **Null check faltante**: Si `Cannot read property X of undefined`, añadir null check.

```typescript
// Antes
const assignee = await userService.findOne(input.assigneeId);
await notify(assignee.email);

// Después (auto-fix)
const assignee = input.assigneeId ? await userService.findOne(input.assigneeId) : null;
if (assignee) {
  await notify(assignee.email);
}
```

2. **Try/catch faltante**: Si un handler crashea sin catch, envolver en try/catch.

3. **Tipo incorrecto**: Si `TypeError: X is not a function`, corregir el tipo.

#### data_fix (confidence: high)

1. **FK violation**: Si `violates foreign key constraint`, el fix es verificar que el ID existe antes de usarlo. O eliminar datos huérfanos.

2. **Unique violation**: Si `duplicate key value`, el fix es usar upsert en lugar de insert.

#### config_fix (confidence: high)

1. **Missing env var**: Si error por variable de entorno faltante, el fix es añadir al `.env.example` y documentar.

### Integración con SpecErrorReporter

Después de que `SpecErrorReporter.report()` genera un `ActionableError`:

```typescript
// spec-error-reporter.ts (extender)
async report(error: SpecError, trace: SpecTrace): Promise<ActionableError> {
  const actionable = this.buildActionableError(error, trace, hash);
  await this.persist(actionable);

  // ─── NUEVO: evaluar auto-fix ───
  if (this.autoFixEnabled() && actionable.suggestedFix) {
    const result = await this.autoFixEngine.evaluate(actionable);
    this.logAutoFixResult(result);
    // Si se aplicó, no abrir GitHub issue
    if (result.status === 'applied') return actionable;
  }

  // GitHub issue solo si no se auto-fixeó
  if (this.isProduction() && actionable.occurrences === 1) {
    await this.openGitHubIssue(actionable);
  }

  return actionable;
}
```

### Endpoint API

```
GET  /api/v1/error-tracker/:id/fix           → devuelve el AutoFixResult si existe
POST /api/v1/error-tracker/:id/fix/apply     → fuerza aplicación del fix (manual trigger)
POST /api/v1/error-tracker/:id/fix/reject    → rechaza el fix sugerido
GET  /api/v1/error-tracker/fixes/history     → historial de auto-fixes aplicados
```

### Loop prevention

Un mismo error no se auto-fixea más de una vez. Si el fix no funciona y el error recurre, se escala a humano:

```typescript
// auto-fix-engine.ts (añadir)
private async checkLoopPrevention(error: ActionableError): Promise<boolean> {
  // Verificar si ya se intentó un auto-fix para este hash
  // Usar error.hash (no error.id) porque el id cambia con cada ocurrencia
  // pero el hash es el mismo para el mismo error deduplicado
  const previousFixes = await this.fixLogRepo.find({
    where: { errorHash: error.hash, status: In(['applied', 'failed']) },
    order: { createdAt: 'DESC' },
    take: 3,
  });

  if (previousFixes.length >= 3) {
    this.logger.warn(`Error hash ${error.hash} has ${previousFixes.length} previous fix attempts — escalating to manual`);
    return false;
  }

  // Si el último fix fue 'applied' pero el error recurre, el fix no funcionó
  const lastFix = previousFixes[0];
  if (lastFix?.status === 'applied') {
    this.logger.warn(`Error hash ${error.hash} recurred after auto-fix — fix was ineffective, escalating`);
    return false;
  }

  return true;
}
```

`evaluate()` debe llamar `checkLoopPrevention()` antes de cualquier acción:

```typescript
async evaluate(error: ActionableError): Promise<AutoFixResult> {
  const canProceed = await this.checkLoopPrevention(error);
  if (!canProceed) {
    return { errorId: error.id, status: 'skipped', confidence: 'low',
      fixType: 'manual', changes: [],
      reason: 'Loop prevention: 3+ previous fix attempts or fix was ineffective' };
  }
  // ... resto del flujo ...
}
```

### code_fix: patrones concretos

El `code_fix` genérico ("revisar handler") es hand-wavy. Estos son los 3 patrones concretos que se pueden generar automáticamente:

**Patrón 1: Null check faltante (confidence: medium)**

Error: `Cannot read properties of undefined (reading 'X')` en handler

```typescript
// Detección
if (error.stack && error.stack.includes('TypeError: Cannot read properties of undefined')) {
  const propMatch = error.stack.match(/reading '(\w+)'/);
  const prop = propMatch?.[1];
  const handlerCode = readFileSync(error.handlerFile, 'utf8');

  // Buscar la línea que accede a X sin null check
  const lines = handlerCode.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`.${prop}`) && !lines[i].includes('?.') && !lines[i].includes('if')) {
      // Generar fix: añadir optional chaining
      const before = lines[i];
      const after = lines[i].replace(`.${prop}`, `?.${prop}`);
      return {
        type: 'code_fix',
        description: `Línea ${i+1} accede a .${prop} sin null check. Cambiar a optional chaining ?..${prop}`,
        targetFile: error.handlerFile,
        suggestedCode: `${before}\n→\n${after}`,
        confidence: 'medium',
      };
    }
  }
}
```

**Patrón 2: Try/catch faltante en hook (confidence: low)**

Error: hook crashea sin try/catch, la operation entera falla

```typescript
// Detección: si el handler no tiene try/catch y el error no es de validación
const handlerCode = readFileSync(error.handlerFile, 'utf8');
if (!handlerCode.includes('try {') && !handlerCode.includes('catch (')) {
  // Generar fix: envolver el body del handler en try/catch
  // Solo si el hook es afterCreate/afterUpdate (no-before hooks, que sí deberían poder abortar)
  if (error.operation.startsWith('hook:after')) {
    return {
      type: 'code_fix',
      description: `Handler de ${error.operation} no tiene try/catch. Las after-hooks no deberían abortar la operación. Envolver en try/catch y loguear error.`,
      targetFile: error.handlerFile,
      confidence: 'low',
      suggestedCode: this.wrapInTryCatch(handlerCode),
    };
  }
}
```

**Patrón 3: Async handler sin await (confidence: medium)**

Error: `Promise <pending>` o operación async no esperada

```typescript
// Detección: handler tiene funciones async sin await
const handlerCode = readFileSync(error.handlerFile, 'utf8');
const asyncCalls = handlerCode.match(/(?:ctx\.|await )\w+\([^)]*\)/g);
const missingAwait = asyncCalls?.find(call => !call.startsWith('await') && call.startsWith('ctx.'));

if (missingAwait) {
  return {
    type: 'code_fix',
    description: `Handler llama a ${missingAwait} sin await. Añadir await.`,
    targetFile: error.handlerFile,
    confidence: 'medium',
    suggestedCode: handlerCode.replace(missingAwait, `await ${missingAwait}`),
  };
}
```

Estos 3 patrones cubren los bugs más comunes. code_fix para otros casos queda como confidence: low y requiere revisión manual.

Variables de entorno que controlan el auto-fix:

```env
# Habilitar/deshabilitar auto-fix
AUTO_FIX_ENABLED=true

# Nivel mínimo de confianza para aplicar automáticamente
# high = solo high confidence se auto-aplica
# medium = medium y high se auto-aplican (medium como PR draft)
# low = todo se intenta (no recomendado)
AUTO_FIX_MIN_CONFIDENCE=high

# Auto-commit después de fix aplicado
AUTO_FIX_AUTO_COMMIT=false

# Auto-deploy después de commit (requiere AUTO_FIX_AUTO_COMMIT=true)
AUTO_FIX_AUTO_DEPLOY=false

# Notificar por webhook cuando se aplica un fix
AUTO_FIX_WEBHOOK_URL=https://hooks.slack.com/...
```

### Logging y auditoría

Cada auto-fix se registra en una tabla `_auto_fix_log`:

```sql
CREATE TABLE _auto_fix_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_id UUID REFERENCES error_logs(id) ON DELETE CASCADE,
  error_hash VARCHAR(64) NOT NULL,  -- hash del error, para loop prevention incluso si se elimina
  status VARCHAR(20) NOT NULL,           -- skipped, pr_created, applied, failed
  confidence VARCHAR(10) NOT NULL,
  fix_type VARCHAR(20) NOT NULL,
  changes JSONB NOT NULL,                -- array de FileChange
  test_result JSONB,
  pr_url VARCHAR(255),
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auto_fix_log_error_id ON _auto_fix_log(error_id);
CREATE INDEX idx_auto_fix_log_error_hash ON _auto_fix_log(error_hash);
CREATE INDEX idx_auto_fix_log_status ON _auto_fix_log(status);
```

### Notificación al usuario

Cuando un auto-fix se aplica, se envía notificación:

1. **Webhook** (Slack/Discord): "Auto-fix applied: {error.category} in {extension}/{resource} — {fix.description}"
2. **Email** al admin: resumen de fixes aplicados en las últimas 24h
3. **Error tracker UI**: el error se marca como "Auto-fixed" con link al commit/PR

## Implementación

### Fase 1: AutoFixEngine core (sin auto-apply)

1. Implementar `AutoFixEngine.evaluate()` con generación de changes
2. Implementar `generateSpecFix()` — el más seguro y común
3. Implementar `testChanges()` usando DB branching (PRD 04)
4. Solo modo `pr_created` (siempre PR draft, nunca auto-apply)

### Fase 2: Spec fixes automáticos

1. Mapear los 3 patrones más comunes de spec_fix:
   - null field → required
   - missing permission → add role
   - missing validation → add constraint
2. Testear con errores reales del codebase
3. Calibrar confidence: spec_fix de permiso = high, spec_fix de required = high, spec_fix de validation = medium

### Fase 3: Code fixes

1. Mapear patrones de code_fix:
   - null check faltante
   - try/catch faltante
2. Usar TypeScript compiler API para modificar código de forma segura
3. Confidence: siempre low/medium para code_fix

### Fase 4: Auto-apply (high confidence)

1. Habilitar `applyFix()` solo para confidence=high
2. Auto-commit (configurable)
3. Notificación webhook
4. Auditoría en `_auto_fix_log`

## Criterios de aceptación

1. Un error con `suggestedFix` de confidence=high se auto-aplica sin intervención
2. Un error con confidence=medium genera PR draft para revisión
3. Un error con confidence=low se skippea y queda para revisión manual
4. Todo auto-fix se testea en DB branch aislada antes de aplicar
5. `_auto_fix_log` registra todos los intentos (skipped, pr_created, applied, failed)
6. `AUTO_FIX_ENABLED=false` deshabilita todo el sistema
7. El error tracker UI muestra "Auto-fixed" en errores resueltos automáticamente
8. Los cambios generados son reversibles (git revert del commit)
9. Spec fixes (required, permission) tienen confidence=high
10. Code fixes (null check, try/catch) tienen confidence=low/medium

## Dependencias

- PRD 01 (Structured Actionable Errors) — sin esto no hay suggestedFix
- PRD 04 (Database Branching) — para testear fixes aislados
- `gh` CLI — para crear PRs (ya usado por spec-error-reporter)

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Auto-fix aplica cambio incorrecto | Confidence threshold + tests en branch + git revert |
| Auto-fix entra en loop (fix introduce nuevo error) | Un error solo se auto-fixea una vez; si recurre, escala a humano |
| Code fixes generan código inválido | TypeScript compiler valida antes de aplicar; si no compila, skip |
| Tests no cubren el caso del fix | Tests del spec engine + tests de la extensión afectada |
| Auto-commit ensucia git history | conventional commits con prefix `fix(auto):` + branch dedicada |