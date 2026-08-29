---
id: "affiliate"
name: "Affiliate Program"
type: "extension"
parent: null
dependencies: ["auth", "crm"]
entities: ["AffiliatePartner", "AffiliateReferral", "AffiliateCommission"]
---

# Affiliate Extension

Programa de afiliados: partners referencian clientes, se trackean referidos y se calculan comisiones. Incluye portal de afiliado (autogestión, rol `affiliate` con acceso restringido) + dashboard admin + conversión CRM→afiliado.

> Full backend reference (entity diagram, endpoints, mermaid flows) lives in
> [`apps/back/src/extensions/affiliate/README.md`](../../apps/back/src/extensions/affiliate/README.md).

## Overview

| Property | Value |
|----------|-------|
| Name | `affiliate` |
| Version | 1.0.0 |
| Dependencies | `auth` |
| Tables | `ext_affiliate_partner`, `ext_affiliate_referral`, `ext_affiliate_commission` |
| Config key | `'affiliate'` |
| Auth | Admin + Partner (portal endpoints) |

## Entities

- **AffiliatePartner** (`ext_affiliate_partner`) — Perfil del afiliado: datos fiscales, código único, estado.
- **AffiliateReferral** (`ext_affiliate_referral`) — Referido trackeado por partner (usuario referido, fecha, estado).
- **AffiliateCommission** (`ext_affiliate_commission`) — Comisión generada por un referido (importe, estado, fecha de pago).

## Controllers

| Controller | Path prefix | Description |
|------------|-------------|-------------|
| AffiliatePartnerController | `affiliate/partners` | CRUD partners (admin) |
| AffiliateReferralController | `affiliate/referrals` | CRUD referrals (admin) |
| AffiliateCommissionController | `affiliate/commissions` | CRUD commissions (admin) |
| AffiliateDashboardController | `affiliate/dashboard` | KPIs agregados (admin) |
| AffiliatePortalController | `affiliate/portal` | Self-service partner (propio perfil, referrals, comisiones) |

## Services

| Service | Responsibility |
|---------|---------------|
| AffiliatePartnerService | CRUD partners, validación fiscal, generación de código único |
| AffiliateReferralService | Tracking de referidos, vinculación con usuario referido |
| AffiliateCommissionService | Cálculo y lifecycle de comisiones (pending → approved → paid) |
| AffiliateDashboardService | Agregados para dashboard admin (top partners, revenue, conversión) |
| AffiliatePortalService | Endpoints del portal self-service (partner autenticado) |
| AffiliateReportService | Reportes exportables (CSV/PDF) por rango de fechas |

## DTOs

- `create-partner.dto.ts`, `update-partner.dto.ts`
- `create-referral.dto.ts`, `update-referral.dto.ts`, `portal-create-referral.dto.ts`
- `create-commission.dto.ts`, `update-commission.dto.ts`
- `update-portal-profile.dto.ts` (partner edita propio perfil)