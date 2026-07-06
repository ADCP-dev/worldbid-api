---
id: "crm"
name: "CRM"
type: "extension"
parent: null
dependencies: ["auth"]
entities: ["CrmClient", "CrmContact", "CrmInteraction", "CrmOrigin", "CrmProject", "CrmStatus"]
---

# CRM Extension

CRM interno: gestión de clientes, contactos, interacciones, proyectos y pipeline de ventas. Orígenes y estados configurables. Dashboard con KPIs agregados.

## Overview

| Property | Value |
|----------|-------|
| Name | `crm` |
| Version | 1.0.0 |
| Dependencies | `auth` |
| Tables | `ext_crm_client`, `ext_crm_contact`, `ext_crm_interaction`, `ext_crm_origin`, `ext_crm_project`, `ext_crm_status` |
| Config key | `'crm'` |
| Auth | Admin-only (todos los endpoints) |

## Entities

- **CrmClient** (`ext_crm_client`) — Cliente (empresa o particular): datos fiscales, estado.
- **CrmContact** (`ext_crm_contact`) — Persona de contacto dentro de un cliente.
- **CrmInteraction** (`ext_crm_interaction`) — Registro de interacción (llamada, email, reunión) vinculada a cliente/contacto.
- **CrmOrigin** (`ext_crm_origin`) — Canal de captación del cliente (referido, web, ads, etc.).
- **CrmProject** (`ext_crm_project`) — Oportunidad/pipeline deal vinculado a un cliente con estado y valor.
- **CrmStatus** (`ext_crm_status`) — Estados configurables para el pipeline de proyectos.

## Controllers

| Controller | Path prefix | Description |
|------------|-------------|-------------|
| CrmClientController | `crm/clients` | CRUD clientes |
| CrmContactController | `crm/contacts` | CRUD contactos |
| CrmInteractionController | `crm/interactions` | CRUD interacciones |
| CrmOriginController | `crm/origins` | CRUD orígenes |
| CrmProjectController | `crm/projects` | CRUD proyectos (pipeline) |
| CrmStatusController | `crm/statuses` | CRUD estados |
| CrmDashboardController | `crm/dashboard` | KPIs: clientes nuevos, pipeline value, conversión |

## Services

| Service | Responsibility |
|---------|---------------|
| CrmClientService | CRUD clientes, validación fiscal |
| CrmContactService | CRUD contactos, vinculación con cliente |
| CrmInteractionService | CRUD interacciones, historial por cliente |
| CrmOriginService | CRUD orígenes (catálogo) |
| CrmProjectService | CRUD proyectos, movimiento de pipeline |
| CrmStatusService | CRUD estados configurables |
| CrmDashboardService | Agregados: clientes nuevos, pipeline value por estado, conversión |

## Seeds

La extensión incluye seed module (`seeds/seed.module.ts` + `crm-seed.service.ts`) que puebla orígenes y estados iniciales de forma idempotente (upsert con UUIDs fijos).