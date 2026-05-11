#!/bin/bash
# Demo: Playwright Test Healer flow
# Simula un cambio de UI que rompe tests y luego los "cura"
set -e

FRONTEND_DIR="apps/front"
TEST_FILE="tests/e2e/auth/login.spec.ts"
COMPONENT_FILE="modules/base/auth/components/auth/AuthSignIn.vue"

cd "$(dirname "$0")/.."

echo "╔══════════════════════════════════════╗"
echo "║   Playwright Healer — Demo Flow     ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 1. Run tests (should all pass)
echo "📋 Paso 1: Ejecutando tests (deberían pasar)..."
cd "$FRONTEND_DIR"
npx playwright test "$TEST_FILE" --reporter=dot
echo ""

# 2. Break the UI
echo "🔨 Paso 2: Simulando cambio de UI (data-testid)..."
COMPONENT_PATH="$COMPONENT_FILE"
sed -i '' 's/data-testid="login-submit"/data-testid="sign-in-btn"/' "$COMPONENT_PATH"
echo "   data-testid cambiado: login-submit → sign-in-btn"
echo ""

# 3. Run tests again
echo "❌ Paso 3: Tests rotos por cambio de UI..."
if npx playwright test "$TEST_FILE" --reporter=dot 2>/dev/null; then
  echo "   (inesperado: tests pasaron)"
else
  echo "   ✅ Tests fallaron (esperado)"
fi
echo ""

# 4. Healer
echo "🩹 Paso 4: Healer analizando fallos..."
sleep 1
echo "   Detectado: '[data-testid=\"login-submit\"]' ya no existe"
echo "   Sugerencia: cambiar a '[data-testid=\"sign-in-btn\"]'"
sed -i '' 's/login-submit/sign-in-btn/g' "$TEST_FILE"
echo "   ✅ Test actualizado"
echo ""

# 5. Run again
echo "✅ Paso 5: Verificando curación..."
npx playwright test "$TEST_FILE" --reporter=dot
echo ""

# 6. Restore
echo "🔄 Restaurando estado original..."
sed -i '' 's/data-testid="sign-in-btn"/data-testid="login-submit"/' "$COMPONENT_PATH"
sed -i '' 's/sign-in-btn/login-submit/g' "$TEST_FILE"
echo "   ✅ Todo restaurado"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║ ✅ Healer demo completado           ║"
echo "╚══════════════════════════════════════╝"
