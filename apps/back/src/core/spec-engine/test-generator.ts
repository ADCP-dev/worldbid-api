/**
 * TestGenerator — CLI utility that reads a spec YAML file and generates
 * a Jest + supertest test scaffold for the extension's resources.
 *
 * The generated test file covers:
 *   - Each required field: "should reject missing <field>"
 *   - Each validation rule: "should reject <field> with invalid value"
 *   - Each enum: "should reject invalid <field> value"
 *   - Each permission: "should allow <role> to <action>" / "should reject <role> from <action>"
 *   - CRUD operations: create, read, update, delete
 *   - Seeds: "should have N seed entries"
 *   - Hooks: scaffold with TODO comment
 *   - Jobs: scaffold with TODO comment
 *   - Notifications: scaffold with TODO comment
 *
 * The test file is written to:
 *   extensions/<name>/__tests__/<name>.spec.test.ts
 *
 * This is a CLI utility (not a NestJS provider).
 *
 * Usage:
 *   ts-node test-generator.ts <extensionName> [extensionsDir]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type {
  ExtensionSpec,
  ResourceSpec,
  FieldSpec,
  PermissionSpec,
  PermissionRole,
  PermissionAction,
  HookSpec,
  JobSpec,
  NotificationSpec,
} from './spec.types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TestGenerationResult {
  testFilePath: string;
  resourceCount: number;
  testCount: number;
}

interface TestBlock {
  name: string;
  body: string;
  children?: TestBlock[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a string to PascalCase.
 */
function pascalCase(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/**
 * Indent a block of text by N spaces.
 */
function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((l) => (l.length === 0 ? '' : pad + l))
    .join('\n');
}

/**
 * Generate a representative valid value for a field type (for test payloads).
 */
function validValueForField(field: FieldSpec): unknown {
  switch (field.type) {
    case 'string':
    case 'text':
      return 'test-value';
    case 'integer':
    case 'ref':
      return 1;
    case 'decimal':
      return 10.5;
    case 'boolean':
      return true;
    case 'datetime':
      return '2024-01-01T00:00:00.000Z';
    case 'date':
      return '2024-01-01';
    case 'json':
      return {};
    case 'enum':
      return field.enum?.[0] ?? 'option1';
    case 'file':
      return 'file-uuid-1234';
    default:
      return null;
  }
}

/**
 * Generate an invalid value for a field (opposite of validValueForField).
 */
function invalidValueForField(field: FieldSpec): unknown {
  switch (field.type) {
    case 'string':
    case 'text':
    case 'file':
      return 12345; // wrong type
    case 'integer':
    case 'ref':
    case 'decimal':
      return 'not-a-number';
    case 'boolean':
      return 'not-a-boolean';
    case 'datetime':
    case 'date':
      return 'not-a-date';
    case 'json':
      return 'not-json';
    case 'enum':
      return '__invalid_enum_value__';
    default:
      return null;
  }
}

/**
 * Build a valid create payload for a resource (all required fields).
 */
function buildValidPayload(spec: ResourceSpec): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of spec.fields) {
    if (field.required || field.default === undefined) {
      payload[field.name] = validValueForField(field);
    }
  }
  return payload;
}

/**
 * Stringify a value for embedding in TS source.
 */
function tsLiteral(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return JSON.stringify(value);
}

/**
 * Build a JS object literal string from a record.
 */
function objectLiteral(
  obj: Record<string, unknown>,
  indentSize: number,
): string {
  const pad = ' '.repeat(indentSize);
  const innerPad = ' '.repeat(indentSize + 2);
  const lines = Object.entries(obj).map(
    ([k, v]) => `${innerPad}${k}: ${tsLiteral(v)},`,
  );
  if (lines.length === 0) return '{}';
  return `{\n${lines.join('\n')}\n${pad}}`;
}

// ─── Spec Loading ────────────────────────────────────────────────────────────

/**
 * Find and read the .spec.yaml file for an extension.
 */
function readSpecFile(
  extensionName: string,
  extensionsDir: string,
): ExtensionSpec {
  const extDir = path.join(extensionsDir, extensionName);
  if (!fs.existsSync(extDir)) {
    throw new Error(`Extension directory not found: ${extDir}`);
  }

  const files = fs
    .readdirSync(extDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.spec.yaml'))
    .map((d) => path.join(extDir, d.name));

  if (files.length === 0) {
    throw new Error(`No .spec.yaml file found in ${extDir}`);
  }

  const raw = fs.readFileSync(files[0], 'utf-8');
  const spec = yaml.load(raw) as ExtensionSpec;
  if (!spec || !spec.name || !Array.isArray(spec.resources)) {
    throw new Error(`Invalid spec in ${files[0]}: missing name or resources`);
  }
  return spec;
}

// ─── Test Block Builders ─────────────────────────────────────────────────────

const ALL_ACTIONS: PermissionAction[] = [
  'list',
  'read',
  'create',
  'update',
  'delete',
];

/**
 * Build CRUD test blocks (create, read, update, delete).
 */
function buildCrudTests(spec: ResourceSpec): TestBlock[] {
  const blocks: TestBlock[] = [];
  const validPayload = buildValidPayload(spec);
  const payloadStr = objectLiteral(validPayload, 8);

  blocks.push({
    name: 'create',
    body: [
      `it('should create a new ${spec.name}', async () => {`,
      `  const res = await request(app.getHttpServer())`,
      `    .post('/api/${spec.name}')`,
      `    .set('Authorization', \`Bearer \${adminToken}\`)`,
      `    .send(${payloadStr.replace(/\n/g, '\n    ')})`,
      `    .expect(201);`,
      `  expect(res.body).toHaveProperty('id');`,
      `  createdId = res.body.id;`,
      `});`,
    ].join('\n'),
  });

  blocks.push({
    name: 'read',
    body: [
      `it('should retrieve a ${spec.name} by id', async () => {`,
      `  const res = await request(app.getHttpServer())`,
      `    .get(\`/api/${spec.name}/\${createdId}\`)`,
      `    .set('Authorization', \`Bearer \${adminToken}\`)`,
      `    .expect(200);`,
      `  expect(res.body).toHaveProperty('id', createdId);`,
      `});`,
    ].join('\n'),
  });

  blocks.push({
    name: 'update',
    body: [
      `it('should update a ${spec.name}', async () => {`,
      `  const res = await request(app.getHttpServer())`,
      `    .patch(\`/api/${spec.name}/\${createdId}\`)`,
      `    .set('Authorization', \`Bearer \${adminToken}\`)`,
      `    .send({ /* TODO: add updatable fields */ })`,
      `    .expect(200);`,
      `});`,
    ].join('\n'),
  });

  blocks.push({
    name: 'delete',
    body: [
      `it('should delete a ${spec.name}', async () => {`,
      `  await request(app.getHttpServer())`,
      `    .delete(\`/api/${spec.name}/\${createdId}\`)`,
      `    .set('Authorization', \`Bearer \${adminToken}\`)`,
      `    .expect(204);`,
      `});`,
    ].join('\n'),
  });

  return blocks;
}

/**
 * Build "should reject missing <field>" tests for each required field.
 */
function buildRequiredFieldTests(spec: ResourceSpec): TestBlock[] {
  const blocks: TestBlock[] = [];
  for (const field of spec.fields) {
    if (!field.required || field.nullable) continue;
    const validPayload = buildValidPayload(spec);
    const omitPayload = { ...validPayload };
    delete omitPayload[field.name];
    const payloadStr = objectLiteral(omitPayload, 6);

    blocks.push({
      name: `missing-${field.name}`,
      body: [
        `it('should reject missing ${field.name}', async () => {`,
        `  const res = await request(app.getHttpServer())`,
        `    .post('/api/${spec.name}')`,
        `    .set('Authorization', \`Bearer \${adminToken}\`)`,
        `    .send(${payloadStr.replace(/\n/g, '\n    ')})`,
        `    .expect(400);`,
        `  expect(res.body.message).toContain('${field.name}');`,
        `});`,
      ].join('\n'),
    });
  }
  return blocks;
}

/**
 * Build "should reject <field> with invalid value" tests for validation rules.
 */
function buildValidationTests(spec: ResourceSpec): TestBlock[] {
  const blocks: TestBlock[] = [];

  for (const field of spec.fields) {
    const validation = field.validation;
    if (!validation) continue;

    // min length
    if (validation.min !== undefined) {
      blocks.push({
        name: `invalid-${field.name}-min`,
        body: [
          `it('should reject ${field.name} with value below min (${validation.min})', async () => {`,
          `  const payload = { ...validPayload, ${field.name}: ${tsLiteral(
            field.type === 'integer' ||
              field.type === 'decimal' ||
              field.type === 'ref'
              ? validation.min - 1
              : 'a',
          )} };`,
          `  const res = await request(app.getHttpServer())`,
          `    .post('/api/${spec.name}')`,
          `    .set('Authorization', \`Bearer \${adminToken}\`)`,
          `    .send(payload)`,
          `    .expect(400);`,
          `});`,
        ].join('\n'),
      });
    }

    // max length
    if (validation.max !== undefined) {
      blocks.push({
        name: `invalid-${field.name}-max`,
        body: [
          `it('should reject ${field.name} with value above max (${validation.max})', async () => {`,
          `  const payload = { ...validPayload, ${field.name}: ${tsLiteral(
            field.type === 'integer' ||
              field.type === 'decimal' ||
              field.type === 'ref'
              ? validation.max + 1
              : 'a'.repeat((validation.max ?? 10) + 1),
          )} };`,
          `  const res = await request(app.getHttpServer())`,
          `    .post('/api/${spec.name}')`,
          `    .set('Authorization', \`Bearer \${adminToken}\`)`,
          `    .send(payload)`,
          `    .expect(400);`,
          `});`,
        ].join('\n'),
      });
    }

    // pattern
    if (validation.pattern) {
      blocks.push({
        name: `invalid-${field.name}-pattern`,
        body: [
          `it('should reject ${field.name} not matching pattern ${validation.pattern}', async () => {`,
          `  const payload = { ...validPayload, ${field.name}: 'does-not-match' };`,
          `  const res = await request(app.getHttpServer())`,
          `    .post('/api/${spec.name}')`,
          `    .set('Authorization', \`Bearer \${adminToken}\`)`,
          `    .send(payload)`,
          `    .expect(400);`,
          `});`,
        ].join('\n'),
      });
    }

    // email
    if (validation.email) {
      blocks.push({
        name: `invalid-${field.name}-email`,
        body: [
          `it('should reject ${field.name} with invalid email format', async () => {`,
          `  const payload = { ...validPayload, ${field.name}: 'not-an-email' };`,
          `  const res = await request(app.getHttpServer())`,
          `    .post('/api/${spec.name}')`,
          `    .set('Authorization', \`Bearer \${adminToken}\`)`,
          `    .send(payload)`,
          `    .expect(400);`,
          `});`,
        ].join('\n'),
      });
    }

    // url
    if (validation.url) {
      blocks.push({
        name: `invalid-${field.name}-url`,
        body: [
          `it('should reject ${field.name} with invalid URL format', async () => {`,
          `  const payload = { ...validPayload, ${field.name}: 'not-a-url' };`,
          `  const res = await request(app.getHttpServer())`,
          `    .post('/api/${spec.name}')`,
          `    .set('Authorization', \`Bearer \${adminToken}\`)`,
          `    .send(payload)`,
          `    .expect(400);`,
          `});`,
        ].join('\n'),
      });
    }

    // Type-based invalid value test
    blocks.push({
      name: `invalid-${field.name}-type`,
      body: [
        `it('should reject ${field.name} with invalid value', async () => {`,
        `  const payload = { ...validPayload, ${field.name}: ${tsLiteral(invalidValueForField(field))} };`,
        `  const res = await request(app.getHttpServer())`,
        `    .post('/api/${spec.name}')`,
        `    .set('Authorization', \`Bearer \${adminToken}\`)`,
        `    .send(payload)`,
        `    .expect(400);`,
        `});`,
      ].join('\n'),
    });
  }

  return blocks;
}

/**
 * Build "should reject invalid <field> value" tests for enum fields.
 */
function buildEnumTests(spec: ResourceSpec): TestBlock[] {
  const blocks: TestBlock[] = [];
  for (const field of spec.fields) {
    if (field.type !== 'enum' || !field.enum || field.enum.length === 0)
      continue;

    blocks.push({
      name: `invalid-enum-${field.name}`,
      body: [
        `it('should reject invalid ${field.name} value', async () => {`,
        `  const payload = { ...validPayload, ${field.name}: '__invalid_enum_value__' };`,
        `  const res = await request(app.getHttpServer())`,
        `    .post('/api/${spec.name}')`,
        `    .set('Authorization', \`Bearer \${adminToken}\`)`,
        `    .send(payload)`,
        `    .expect(400);`,
        `});`,
      ].join('\n'),
    });

    // Also test that valid enum values are accepted
    blocks.push({
      name: `valid-enum-${field.name}`,
      body: [
        `it('should accept valid ${field.name} value', async () => {`,
        `  const payload = { ...validPayload, ${field.name}: ${tsLiteral(field.enum[0])} };`,
        `  const res = await request(app.getHttpServer())`,
        `    .post('/api/${spec.name}')`,
        `    .set('Authorization', \`Bearer \${adminToken}\`)`,
        `    .send(payload)`,
        `    .expect(201);`,
        `  createdId = res.body.id;`,
        `});`,
      ].join('\n'),
    });
  }
  return blocks;
}

/**
 * Build "should allow <role> to <action>" / "should reject <role> from <action>" tests.
 */
function buildPermissionTests(spec: ResourceSpec): TestBlock[] {
  const blocks: TestBlock[] = [];
  const permissions = spec.permissions;
  if (!permissions) return blocks;

  const roles: PermissionRole[] = ['admin', 'user', 'public'];

  for (const action of ALL_ACTIONS) {
    const allowedRoles = permissions[action];
    if (!allowedRoles) continue;

    const deniedRoles = roles.filter((r) => !allowedRoles.includes(r));

    for (const role of allowedRoles) {
      blocks.push({
        name: `allow-${role}-${action}`,
        body: [
          `it('should allow ${role} to ${action}', async () => {`,
          `  const token = tokensByRole['${role}'];`,
          `  const method = '${action === 'list' ? 'get' : action === 'create' ? 'post' : action === 'update' ? 'patch' : action === 'delete' ? 'delete' : 'get'}';`,
          `  const url = '/api/${spec.name}'${action === 'read' || action === 'update' || action === 'delete' ? " + '/' + createdId" : ''};`,
          `  await request(app.getHttpServer())`,
          `    .${action === 'list' || action === 'read' ? 'get' : action === 'create' ? 'post' : action === 'update' ? 'patch' : 'delete'}(url)`,
          `    .set('Authorization', \`Bearer \${token}\`)`,
          action === 'create' || action === 'update'
            ? `    .send(validPayload)`
            : ``,
          `    .expect((res: any) => {`,
          `      expect(res.status).not.toBe(403);`,
          `    });`,
          `});`,
        ]
          .filter((l) => l.length > 0)
          .join('\n'),
      });
    }

    for (const role of deniedRoles) {
      blocks.push({
        name: `reject-${role}-${action}`,
        body: [
          `it('should reject ${role} from ${action}', async () => {`,
          `  const token = tokensByRole['${role}'];`,
          `  await request(app.getHttpServer())`,
          `    .${action === 'list' || action === 'read' ? 'get' : action === 'create' ? 'post' : action === 'update' ? 'patch' : 'delete'}('/api/${spec.name}'${action === 'read' || action === 'update' || action === 'delete' ? " + '/' + createdId" : ''})`,
          `    .set('Authorization', \`Bearer \${token}\`)`,
          action === 'create' || action === 'update'
            ? `    .send(validPayload)`
            : ``,
          `    .expect(403);`,
          `});`,
        ]
          .filter((l) => l.length > 0)
          .join('\n'),
      });
    }
  }

  return blocks;
}

/**
 * Build "should have N seed entries" tests.
 */
function buildSeedTests(spec: ResourceSpec): TestBlock[] {
  const blocks: TestBlock[] = [];
  if (!spec.seeds || spec.seeds.length === 0) return blocks;

  blocks.push({
    name: `seeds`,
    body: [
      `it('should have ${spec.seeds.length} seed entries for ${spec.name}', async () => {`,
      `  const res = await request(app.getHttpServer())`,
      `    .get('/api/${spec.name}')`,
      `    .set('Authorization', \`Bearer \${adminToken}\`)`,
      `    .expect(200);`,
      `  expect(Array.isArray(res.body.items ?? res.body)).toBe(true);`,
      `  // TODO: assert exact count after seed insertion`,
      `  // expect((res.body.items ?? res.body).length).toBeGreaterThanOrEqual(${spec.seeds.length});`,
      `});`,
    ].join('\n'),
  });

  return blocks;
}

/**
 * Build hook scaffold tests with TODO comments.
 */
function buildHookTests(spec: ResourceSpec): TestBlock[] {
  const blocks: TestBlock[] = [];
  const hooks: HookSpec | undefined = spec.hooks;
  if (!hooks) return blocks;

  const hookPoints = [
    { key: 'beforeCreate', label: 'before create' },
    { key: 'afterCreate', label: 'after create' },
    { key: 'beforeUpdate', label: 'before update' },
    { key: 'afterUpdate', label: 'after update' },
    { key: 'beforeDelete', label: 'before delete' },
    { key: 'afterDelete', label: 'after delete' },
  ] as const;

  for (const hp of hookPoints) {
    const handler = (hooks as any)[hp.key] as string | undefined;
    if (!handler) continue;

    blocks.push({
      name: `hook-${hp.key}`,
      body: [
        `it('should execute ${hp.label} hook for ${spec.name}', async () => {`,
        `  // TODO: implement hook test for handler: ${handler}`,
        `  // The hook is registered at the ${hp.key} lifecycle point.`,
        `  // 1. Trigger the corresponding CRUD operation`,
        `  // 2. Assert side effects (e.g. field mutation, external call)`,
        `  // 3. Verify the hook was invoked (via spy or observable effect)`,
        `  expect(true).toBe(true); // placeholder`,
        `});`,
      ].join('\n'),
    });
  }

  return blocks;
}

/**
 * Build job scaffold tests with TODO comments.
 */
function buildJobTests(spec: ResourceSpec): TestBlock[] {
  const blocks: TestBlock[] = [];
  if (!spec.jobs || spec.jobs.length === 0) return blocks;

  for (const job of spec.jobs) {
    blocks.push({
      name: `job-${job.name}`,
      body: [
        `it('should run job ${job.name} (${job.schedule}: ${job.value})', async () => {`,
        `  // TODO: implement job test for handler: ${job.handler}`,
        `  // Schedule: ${job.schedule} = ${job.value}`,
        `  // Queue: ${job.queue ?? 'default'}`,
        `  // Retries: ${job.retries ?? 0}, backoff: ${job.backoff ?? 'fixed'}`,
        `  // 1. Mock the job handler or queue`,
        `  // 2. Trigger the job manually`,
        `  // 3. Assert the handler was called with expected context`,
        `  expect(true).toBe(true); // placeholder`,
        `});`,
      ].join('\n'),
    });
  }

  return blocks;
}

/**
 * Build notification scaffold tests with TODO comments.
 */
function buildNotificationTests(spec: ResourceSpec): TestBlock[] {
  const blocks: TestBlock[] = [];
  if (!spec.notifications || spec.notifications.length === 0) return blocks;

  for (const notif of spec.notifications) {
    blocks.push({
      name: `notif-${notif.name}`,
      body: [
        `it('should send notification ${notif.name} on ${notif.trigger.on}', async () => {`,
        `  // TODO: implement notification test`,
        `  // Channel: ${notif.channel}`,
        `  // Trigger: ${notif.trigger.on}${notif.trigger.when ? ` when ${notif.trigger.when}` : ''}`,
        `  // Template: ${notif.template ?? 'N/A'}`,
        `  // Recipient: ${notif.to ?? 'N/A'}`,
        `  // 1. Mock the notification dispatcher (email/webhook/sms)`,
        `  // 2. Trigger the lifecycle event`,
        `  // 3. Assert the notification was dispatched with correct payload`,
        `  expect(true).toBe(true); // placeholder`,
        `});`,
      ].join('\n'),
    });
  }

  return blocks;
}

// ─── Test File Rendering ─────────────────────────────────────────────────────

/**
 * Render a TestBlock tree into Jest-compatible TS source.
 */
function renderBlocks(blocks: TestBlock[], level: number): string {
  const pad = ' '.repeat(level * 2);
  const lines: string[] = [];

  for (const block of blocks) {
    if (block.children && block.children.length > 0) {
      lines.push(`${pad}describe('${block.name}', () => {`);
      lines.push(renderBlocks(block.children, level + 1));
      lines.push(`${pad}});`);
    } else {
      lines.push(`${pad}${block.body}`);
      lines.push('');
    }
  }

  return lines
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n');
}

/**
 * Render the full test file content.
 */
function renderTestFile(
  extensionSpec: ExtensionSpec,
  resourceBlocks: TestBlock[],
): string {
  const specName = extensionSpec.name;
  const pascalName = pascalCase(specName);
  const validPayload = buildValidPayload(extensionSpec.resources[0]);
  const payloadStr = objectLiteral(validPayload, 4);

  // Build tokensByRole map literal
  const rolesLine = `const tokensByRole: Record<string, string> = {
    admin: adminToken,
    customer: customerToken,
    affiliate: userToken,
    public: '',
  };`;

  return `/**
 * Auto-generated test scaffold for extension: ${specName}
 * Generated by spec-engine/test-generator.ts
 *
 * This file provides Jest + supertest tests covering:
 *   - Required field validation
 *   - Validation rules (min, max, pattern, email, url)
 *   - Enum value validation
 *   - Role-based permissions (allow/reject)
 *   - CRUD operations (create, read, update, delete)
 *   - Seed entries
 *   - Hooks, Jobs, Notifications (TODO scaffolds)
 *
 * Customize the TODO sections and adjust auth token setup
 * to match your application's authentication flow.
 */

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import type { ExtensionSpec } from '@core/spec-engine/spec.types';

// TODO: import the actual AppModule or extension module under test
// import { AppModule } from '@src/app.module';

describe('${specName} extension', () => {
  let app: INestApplication;
  let adminToken: string;
  let customerToken: string;
  let userToken: string;
  let createdId: number;

  ${rolesLine}

  const validPayload = ${payloadStr};

  beforeAll(async () => {
    // TODO: bootstrap the NestJS application with the extension loaded
    // const moduleRef = await Test.createTestingModule({
    //   imports: [AppModule],
    // }).compile();
    // app = moduleRef.createNestApplication();
    // await app.init();

    // TODO: authenticate as each role and capture tokens
    adminToken = 'admin-token-placeholder';
    customerToken = 'customer-token-placeholder';
    userToken = 'user-token-placeholder';
  });

  afterAll(async () => {
    // TODO: clean up
    // if (app) await app.close();
  });

  beforeEach(() => {
    // Reset createdId before each resource test suite
    createdId = 0;
  });

${renderBlocks(resourceBlocks, 1)}
});
`;
}

// ─── Main Generator ──────────────────────────────────────────────────────────

export class TestGenerator {
  /**
   * Generate a Jest + supertest test scaffold file for an extension's spec.
   *
   * @param extensionName Name of the extension (subdirectory under extensionsDir)
   * @param extensionsDir Absolute path to the extensions/ directory
   * @returns Generation result with metadata about what was generated
   */
  static async generate(
    extensionName: string,
    extensionsDir: string,
  ): Promise<TestGenerationResult> {
    const spec = readSpecFile(extensionName, extensionsDir);

    // Build test blocks for each resource
    const resourceBlocks: TestBlock[] = [];
    let testCount = 0;

    for (const resource of spec.resources) {
      const blocks: TestBlock[] = [];

      // 1. CRUD operations
      const crud = buildCrudTests(resource);
      if (crud.length > 0) {
        blocks.push({
          name: `${resource.name} — CRUD`,
          children: crud,
          body: '',
        });
        testCount += crud.length;
      }

      // 2. Required field tests
      const required = buildRequiredFieldTests(resource);
      if (required.length > 0) {
        blocks.push({
          name: `${resource.name} — required fields`,
          children: required,
          body: '',
        });
        testCount += required.length;
      }

      // 3. Validation rule tests
      const validation = buildValidationTests(resource);
      if (validation.length > 0) {
        blocks.push({
          name: `${resource.name} — validation`,
          children: validation,
          body: '',
        });
        testCount += validation.length;
      }

      // 4. Enum tests
      const enums = buildEnumTests(resource);
      if (enums.length > 0) {
        blocks.push({
          name: `${resource.name} — enums`,
          children: enums,
          body: '',
        });
        testCount += enums.length;
      }

      // 5. Permission tests
      const perms = buildPermissionTests(resource);
      if (perms.length > 0) {
        blocks.push({
          name: `${resource.name} — permissions`,
          children: perms,
          body: '',
        });
        testCount += perms.length;
      }

      // 6. Seed tests
      const seeds = buildSeedTests(resource);
      if (seeds.length > 0) {
        blocks.push({
          name: `${resource.name} — seeds`,
          children: seeds,
          body: '',
        });
        testCount += seeds.length;
      }

      // 7. Hook tests
      const hooks = buildHookTests(resource);
      if (hooks.length > 0) {
        blocks.push({
          name: `${resource.name} — hooks`,
          children: hooks,
          body: '',
        });
        testCount += hooks.length;
      }

      // 8. Job tests
      const jobs = buildJobTests(resource);
      if (jobs.length > 0) {
        blocks.push({
          name: `${resource.name} — jobs`,
          children: jobs,
          body: '',
        });
        testCount += jobs.length;
      }

      // 9. Notification tests
      const notifs = buildNotificationTests(resource);
      if (notifs.length > 0) {
        blocks.push({
          name: `${resource.name} — notifications`,
          children: notifs,
          body: '',
        });
        testCount += notifs.length;
      }

      resourceBlocks.push(...blocks);
    }

    // Render the test file
    const content = renderTestFile(spec, resourceBlocks);

    // Write to extensions/<name>/__tests__/<name>.spec.test.ts
    const extDir = path.join(extensionsDir, extensionName);
    const testDir = path.join(extDir, '__tests__');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const testFilePath = path.join(testDir, `${extensionName}.spec.test.ts`);
    fs.writeFileSync(testFilePath, content, 'utf-8');

    this.log(`\n🧪 Test scaffold written: ${testFilePath}`);
    this.log(`   Resources: ${spec.resources.length}`);
    this.log(`   Tests: ${testCount}`);

    return {
      testFilePath,
      resourceCount: spec.resources.length,
      testCount,
    };
  }

  /**
   * Console logger (overridable for testing).
   */
  protected static log(message: string): void {
    // eslint-disable-next-line no-console
    console.log(`[TestGenerator] ${message}`);
  }
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

/**
 * Run from CLI: ts-node test-generator.ts <extensionName> [extensionsDir]
 *
 * Defaults:
 *   extensionsDir = <cwd>/extensions
 */
function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error(
      'Usage: ts-node test-generator.ts <extensionName> [extensionsDir]',
    );
    process.exit(1);
  }

  const extensionName = args[0];
  const extensionsDir = args[1] ?? path.resolve(process.cwd(), 'extensions');

  TestGenerator.generate(extensionName, extensionsDir)
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log(
        `\n✅ Done. Generated ${result.testCount} tests across ${result.resourceCount} resources.`,
      );
    })
    .catch((err) => {
      console.error(`\n❌ Test generation failed: ${(err as Error).message}`);
      process.exit(1);
    });
}

// Run main only when executed directly (not when imported)
if (require.main === module) {
  main();
}
