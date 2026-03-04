# CLI Generators (Hygen)

The backend uses **Hygen** for scaffolding. All commands run from `apps/back/`.

```
apps/back/.hygen/
├── generate/
│   ├── relational-resource/   # Full CRUD resource (custom/modules)
│   └── extension-resource/     # Resource inside an extension
├── property/
│   ├── add-to-relational/     # Add field to a regular resource
│   └── add-to-extension/      # Add field to an extension resource
└── seeds/
    └── create-relational/     # New seeder file
```

---

## APP_MODE Variable

In `apps/back/.env`:

| Value         | Behavior                                     |
| ------------- | -------------------------------------------- |
| `development` | Allows choosing destination (custom/modules) |
| `client`      | Only generates in `custom/`                  |

You can also override via CLI: `--destination=modules`

---

## Available Commands

### `pnpm generate:resource`

Scaffolds a full CRUD module:

```
src/<destination>/<name>/
├── <name>.module.ts
├── <name>.controller.ts
├── <name>.service.ts
├── domain/<name>.ts           # Domain object (no DB dependencies)
├── dto/
│   ├── create-<name>.dto.ts
│   ├── update-<name>.dto.ts
│   └── find-all-<name>.dto.ts
└── infrastructure/
    ├── persistence.module.ts
    ├── <name>.repository.ts
    └── entities/<name>.entity.ts
    └── mappers/<name>.mapper.ts
```

- **Destination**: `custom/` (default) or `modules/` (development only)
- In `client` mode, only `custom/` is allowed

### `pnpm generate:extension`

Same as above but outputs to `src/extensions/<extension-name>/<resource>/`.

### `pnpm add:property`

Adds a new column to an existing resource. Prompts for:

- **Resource name** (must already exist)
- **Property name** (camelCase)
- **Property type** (`string`, `number`, `boolean`, `Date`)
- **Is nullable?**

Updates entity, domain object, DTOs, and mapper.

### `pnpm add:extension-property`

Same as `add:property` but targets an extension resource.

### `pnpm seed:create`

Creates an empty seed file in `src/infrastructure/database/seeds/`.

### `pnpm migration:generate --name=MyMigration`

See [BACKEND-RESOURCES.md](./BACKEND-RESOURCES.md#4-database-migrations) for full migration docs.

---

## Template Format (EJS)

Each `.ejs.t` file has a YAML front-matter header and an EJS body:

```ejs
---
to: src/<%= name %>/<%= name %>.service.ts
---
import { Injectable } from '@nestjs/common';

@Injectable()
export class <%= h.capitalize(name) %>Service {
  // …
}
```

### Common EJS Helpers

| Helper                         | Example output             |
| ------------------------------ | -------------------------- |
| `h.capitalize(name)`           | `product` → `Product`      |
| `h.inflection.pluralize(name)` | `product` → `products`     |
| `h.changeCase.camel(name)`     | `my-product` → `myProduct` |
| `h.changeCase.pascal(name)`    | `my-product` → `MyProduct` |
| `h.changeCase.snake(name)`     | `myProduct` → `my_product` |

---

## Customizing Templates

Edit the `.ejs.t` files in `.hygen/` directly. They are plain text files — no build step needed.

Example: adding a default `@JwtAuth()` to every generated controller:

```ejs
---
to: src/<%= name %>/<%= name %>.controller.ts
---
import { JwtAuth } from '@iam/auth/decorators/auth.decorator';

@JwtAuth()
@Controller('<%= name %>')
export class <%= h.capitalize(name) %>Controller { … }
```

---

## Creating a Custom Generator

1. Create a folder: `apps/back/.hygen/my-generator/new/`
2. Add `.ejs.t` files with `to:` headers
3. Add a prompt file `index.js` if you need user input

```javascript
// .hygen/my-generator/new/index.js
module.exports = {
  prompt: ({ inquirer }) =>
    inquirer.prompt([{ type: "input", name: "name", message: "Name?" }]),
};
```

4. Run with:

```bash
npx hygen my-generator new
```
