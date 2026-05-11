---
id: "playwright-test-agents"
name: "Playwright Test Agents"
type: "module"
parent: null
dependencies: ["auth"]
---

# Playwright Test Agents — Guía de uso

## ¿Qué son?

Agentes de IA integrados en OpenCode que generan, ejecutan y mantienen tests E2E
para el frontend Nuxt. Navegan el navegador real, inspeccionan el DOM y escriben
código TypeScript ejecutable con Playwright.

## Agentes disponibles

| Agente | Comando | Qué hace |
|--------|---------|----------|
| `playwright-test-planner` | `Task(planner)` | Analiza una spec y propone un plan de tests |
| `playwright-test-generator` | `Task(generator)` | Navega la app y genera `.spec.ts` |
| `playwright-test-healer` | `Task(healer)` | Analiza tests fallidos y los repara |

## Flujo básico

### 1. Planificar tests

Desde una especificación o historia de usuario:

```
Tú: Quiero tests E2E para el flujo de login. La página está en /login,
    tiene campos email/password y botón submit. Usa data-testid.

Agente (planner): Plan de tests:
  1. Login exitoso → rellena credenciales, verifica redirección
  2. Login fallido → credenciales inválidas, verifica error
  3. Campos vacíos → verifica validación
  4. Navegación a registro → clic en link
```

### 2. Generar código

```
Tú: Genera los tests del plan anterior

Agente (generator): Abriendo navegador... Navegando a /login...
  Generado tests/e2e/auth/login.spec.ts
```

### 3. Ejecutar tests

```bash
cd apps/front && npx playwright test
```

### 4. Curar tests rotos

Cuando un cambio en la UI rompe los tests:

```
Tú: El test login.spec.ts falla. Arréglalo.

Agente (healer): Detectado: data-testid cambió de "login-submit" a "sign-in-btn".
  Actualizando test... Listo.
```

```bash
npx playwright test  # vuelve a pasar
```

## data-testid

Los tests usan `data-testid` para selectores robustos. Al modificar componentes,
mantené estos atributos:

```html
<!-- FormInput.vue -->
<input :data-testid="testId" />

<!-- AuthSignIn.vue -->
<FormInput testId="login-email" />
<PasswordInput testId="login-password" />
<button data-testid="login-submit" />
```

## Tests existentes

| Archivo | Cobertura |
|---------|-----------|
| `tests/e2e/auth/login.spec.ts` | Login (4 tests) |
| `tests/e2e/auth/register.spec.ts` | Registro (3 tests) |
| `tests/e2e/auth/forgot-password.spec.ts` | Recuperación (3 tests) |
| `tests/e2e/auth/protected-routes.spec.ts` | Rutas protegidas (2 tests) |
| `tests/e2e/stripe/success.spec.ts` | Página de éxito checkout (2 tests) |
| `tests/e2e/stripe/stripe-test.spec.ts` | Stripe Test Suite (5 tests) |
| `tests/e2e/stripe/plan.spec.ts` | Plan de suscripción (5 tests) |
| **Total** | **24 tests, 7 suites** |

## CI/CD (pendiente)

```yaml
# .github/workflows/e2e.yml
- name: Playwright E2E
  run: |
    cd apps/front
    npx playwright test
```

## Notas

- El backend debe estar corriendo (`pnpm dev --filter foundation-nestjs`)
- `playwright.config.ts` arranca el frontend automáticamente vía `webServer`
- Los agentes usan Chromium. La primera ejecución descarga ~165MB
- `@playwright/test` está como devDependency en `apps/front/package.json`
