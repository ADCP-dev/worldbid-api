# PRD: Stripe Module — Foundation Extension

## 1. Overview

Módulo de extensión para gestionar productos, planes de suscripción, suscripciones y facturación por uso con Stripe. Sigue el patrón de extensiones auto-discovery de Foundation (docs/EXTENSIONS-SYSTEM.md).

Ubicación: apps/back/src/extensions/stripe/

## 2. Herramientas Stripe Disponibles

| Herramienta | Uso |
|------------|-----|
| Stripe MCP | npx -y @stripe/mcp --api-key=STRIPE_SECRET_KEY — MCP server local para agentes AI |
| Stripe MCP Remote | https://mcp.stripe.com — MCP server remoto con OAuth |
| Stripe CLI | stripe CLI — gestionar recursos, testear webhooks, triggers |
| @stripe/agent-toolkit | SDK para integrar Stripe con OpenAI/LangChain/CrewAI/Vercel AI SDK |
| Stripe Node SDK | stripe npm package — API de Stripe en TypeScript |

## 3. Estructura del Módulo

extensions/stripe/
├── extension.module.ts          ← Auto-discovery
├── domain/ (product, price, plan, subscription, usage-record)
├── dto/
├── controllers/
├── services/
├── middleware/plan-guard.ts     ← PlanGuard + @RequiredFeature decorator
└── infrastructure/persistence/entities/

## 4. Entidades y Relaciones 1:1

Las relaciones son OneToOne para máxima flexibilidad

- Product (ext_stripe_product): stripeId, name, description, active, metadata
- Price (ext_stripe_price): stripeId, productId (1:1), currency, unitAmount, type, interval, active
- Plan (ext_stripe_plan): name, description, priceId (1:1), maxUsers, maxStorage, features[], isDefault, active
- Subscription (ext_stripe_subscription): stripeId, userId, planId (1:1), status, currentPeriodStart/End, cancelAtPeriodEnd, trialEnd
- UsageRecord (ext_stripe_usage_record): subscriptionId (1:1), stripeId, quantity, timestamp, action

## 5. Middleware PlanGuard

@Injectable() PlanGuard implements CanActivate
Decorator @RequiredFeature('api_access')
Controla acceso a features según el plan contratado

## 6. Endpoints

Plans: GET/POST /stripe/plans (admin), GET/PATCH /stripe/plans/:id
Products: GET/POST /stripe/products (admin), GET/PATCH/DELETE /stripe/products/:id
Prices: GET /stripe/prices?productId=xxx, POST /stripe/prices (admin)
Subscriptions: GET /stripe/subscriptions/me, POST /stripe/subscriptions, PATCH/DELETE /stripe/subscriptions/:id, POST /stripe/subscriptions/:id/resume
Webhooks: POST /stripe/webhooks (Stripe signature)

## 7. Frontend — Perfil y Gestión de Plan

Nav: Settings → Plan (CreditCard icon, /app/settings/plan)
Página: PlanStatusBadge, PlanFeaturesList, PlanUsageBar, ChangePlanModal
Composable: useSubscription() con TanStack Query

## 8. Integración Stripe

Stripe MCP en opencode.jsonc:
"stripe": { "type": "local", "command": ["npx", "-y", "@stripe/mcp", "--api-key={env:STRIPE_SECRET_KEY}"], "enabled": true }

Stripe CLI:
brew install stripe/stripe-cli/stripe
stripe listen --forward-to localhost:3001/api/v1/stripe/webhooks

## 9. Checklist

- [ ] Crear estructura extensions/stripe/
- [ ] Implementar entidades (Product, Price, Plan, Subscription, UsageRecord)
- [ ] Implementar DTOs con class-validator
- [ ] Implementar servicios CRUD
- [ ] Implementar controladores JWT + Roles
- [ ] Implementar middleware PlanGuard + @RequiredFeature
- [ ] Implementar webhook de Stripe
- [ ] Crear extension.module.ts (auto-discovery)
- [ ] Frontend: página /app/settings/plan + nav entry
- [ ] Frontend: composable useSubscription()
- [ ] Configurar Stripe MCP en opencode.jsonc
- [ ] Instalar Stripe CLI
- [ ] Verificar compilación TypeScript
- [ ] Generar migración TypeORM
