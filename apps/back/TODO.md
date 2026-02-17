# TODOS

## TODO Backend NestJS

- [x] Maildev to Mailpit
- [x] Mail with attachments or multiple attachments
- [x] Mail with Tailwind CSS
- [x] Fix mail user confirmation -> this is do it in the front end
- [x] Test mail user reset password
- [x] Prettify emails tailwind
- [x] Logo in emails
- [x] Do better pagination
- [x] Do filters or search like laravel query or strapi CMS
- [x] Do filters in pagination and search all
- [x] Docs email development
- [x] Docs url filters
- [x] Review file upload
- [x] Fix pagination (totalCount with filters, and implement to user)
- [ ] File private/public fixes:
  - [x] Fix path private/public (now is /api/v1/private/files, has to be /api/v1/files/private) -> local connector
  - [x] Fix isPublic parameter, not working
  - [x] Fix path is not synchronized with the file path db
  - [x] Fix swagger file docs parameters
  - [ ] File private/public with user or not
  - [ ] The private only can be see it if the is the owner or the user is admin
  - [ ] (Future) when ABAC is done, implement in files authorization
- [ ] Fix on s3 connector
- [x] Do delete and update file upload
- [ ] Authz, hybrid ABAC + RBAC
  - [x] ABAC authorization
  - [x] RBAC authorization
  - [x] Test ABAC own permissions
  - [x] Dynamic own permissions (with the entity name between the last ":" and the ":own" suffix, automatically)
  - [ ] Enum, seeders and check database, better
  - [ ] On create resource, create permissions
  - [ ] Custom policies for ABAC
  - [ ] Show all items that the user has permission to see (I think, add to request a boolean to fetch only items that the user has permission to see)
  - [ ] Update the gen modules to add the permissions to the entities
  - [ ] Update the docs
- [ ] Test google sign in
- [ ] Add primitive types to the entities (DateTime, JSON, Cords, etc All types of postgres and typeorm)
- [ ] Recursive relations
- [ ] Translation of validation messages
- [ ] Export/import data to csv/json
- [ ] 2FA implementation
- [ ] Log and monitoring, metrics, health, etc @nestjs/terminus
- [ ] Security (Rate limiting, brute force protection on login, etc)
- [ ] Webhooks
- [ ] PDF generation
- [ ] Simplify the project, also put all the related things in a directory like inside auth, have auth apple, auth google, auth facebook, etc
- [ ] Separate the base modules from the main project, for installing new modules easly coping the code
- [ ] Test all implementation
- [ ] Do better code in (and clean files):
  - [ ] File module (service, controller, docs) and update docs
  - [ ] Mail module (service, controller, docs) and update docs
  - [ ] Auth module (service, controller, docs) and update docs
- [ ] Modules script instalation:
  - [ ] ABAC
  - [ ] Stripe payments + subscriptions
  - [ ] Newsletter
  - [ ] API token
  - [ ] Share files (optional)
  - [ ] Organizations (optional)
  - [ ] 2FA implementation
  - [ ] PDF generation

Extras:

- [ ] Newsletter
- [ ] Share files to users with permissions
- [ ] Organizations with permissions (each user can be in one or more organizations, and have his permissions and role in each organization)
- [ ] Config for the app gen (like: isAbacEnabled for not put in the modules the permissions.) For example for create a minimal api without abac, roles, etc.

## TODO Backend NestJS Frontend integration

- [ ] Api for get all the entities
- [ ] Api for get one description detailed of the entity for code generation frontend
  - [ ] Get structure and types of the entity
  - [ ] Get relations of the entity
  - [ ] Get validation structure of the entity
- [ ] Table component for frontend with url filters and export to csv
- [ ] Driverjs and confetti

## TODO Frontend NuxtJS

- [ ] Automate Form and do it better
- [ ] Automate table and do it better
- [ ] Generate code for frontend
- [ ] Itegration strapi CMS Admin
- [ ] Itegration MedusaJs Admin

## TODO Frontend Astrojs

- [ ] Itegration strapi CMS Frontend
- [ ] Itegration MedusaJs Frontend
