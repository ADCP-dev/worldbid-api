# Custom Generators (Hygen)

The backend uses **Hygen** for scaffolding code. This allows you to quickly generate boilerplate code for new resources, properties, and seeds.

## Location

The generator templates are located in `apps/back/.hygen`.
Each folder represents a generator (e.g., `generate`, `property`, `seeds`).

## Available Generators

### 1. Generate Resource (`generate:resource`)

Command: `npm run generate:resource`
Template Location: `apps/back/.hygen/generate/relational-resource`

This generator creates a complete CRUD module structure:

- **Module**: `src/<name>/<name>.module.ts`
- **Controller**: `src/<name>/<name>.controller.ts`
- **Service**: `src/<name>/<name>.service.ts`
- **Entity**: `src/<name>/infrastructure/persistence/relational/entities/<name>.entity.ts`
- **DTOs**: `src/<name>/dto/*.dto.ts`

**Customization**:
To modify the generated files, edit the `.ejs.t` files in the template directory.
For example, to add a default import to every new controller, edit `controller.ejs.t`.

### 2. Add Property (`add:property`)

Command: `npm run add:property`
Template Location: `apps/back/.hygen/property/add-to-relational`

This generator adds a new field to an existing entity and updates:

- **Entity**: Adds the `@Column()` definition.
- **DTOs**: Adds the field to `create`, `update`, and response DTOs.
- **Service/Mapper**: Updates the mapper if necessary.

**Customization**:
You can add new types of columns or change the validation decorators applied to new fields by editing the `.ejs.t` files.

### 3. Create Seed (`seed:create`)

Command: `npm run seed:create`
Template Location: `apps/back/.hygen/seeds/create-relational`

Creates a new seed file in `src/database/seeds/relational`.

## How to Customize Templates

Hygen templates use **EJS** (Embedded JavaScript) for rendering.

### File Header

Each `.ejs.t` file has a header that defines where the file will be generated:

```ejs
---
to: src/<%= name %>/dto/create-<%= name %>.dto.ts
---
```

### Variables

You can use variables passed from the prompt (like `name`) in the template:

```typescript
export class Create<%= h.capitalize(name) %>Dto {
  // ...
}
```

### Helpers

Hygen provides helpers like `h.capitalize()`, `h.inflection.pluralize()`, etc., to format names correctly.

## Creating a New Generator

1.  Create a new folder in `apps/back/.hygen/my-generator`.
2.  Create a `new` folder inside it.
3.  Add `.ejs.t` files for the files you want to generate.
4.  Run it with `npx hygen my-generator new`.
