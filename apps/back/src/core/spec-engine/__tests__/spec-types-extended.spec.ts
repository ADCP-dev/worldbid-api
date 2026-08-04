/**
 * Spec Types Extended — Unit tests
 *
 * Tests the type-surface changes introduced by change
 * `spec-engine-v2-frontend-and-loader` (Slice 1):
 *   - FieldUISpec consolidated (single definition, union of L36 + L274)
 *   - New UI hints: section, showIf, cols, order, placeholder, helpText, multiple, accept
 *   - FieldType accepts 'password' and 'secret' (aliases)
 *   - ChartType accepts 'table' and 'list'
 *   - ResourceUISpec.sections / steps / tabs
 *   - SpecValidator accepts specs using the new fields/types
 *   - entity-factory does NOT hash password/secret (plain string column)
 *
 * RED phase: new type fields / chart types / validator entries do not exist yet.
 */

import { SpecValidator } from '@core/spec-engine/spec-validator';
import { EntityFactory } from '@core/spec-engine/entity-factory';
import type {
  ExtensionSpec,
  FieldSpec,
  FieldUISpec,
  ResourceSpec,
  LoadedSpec,
} from '@core/spec-engine/spec.types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function emptyLoaded(resource: ResourceSpec): LoadedSpec {
  return {
    spec: {
      name: 'demo',
      version: '1.0.0',
      resources: [resource],
    },
    dir: '/tmp/demo',
    specPath: '/tmp/demo/demo.spec.yaml',
  };
}

function baseResource(fields: ResourceSpec['fields']): ResourceSpec {
  return {
    name: 'Issue',
    table: 'ext_demo_issues',
    fields,
  };
}

// ─── FieldUISpec consolidation ──────────────────────────────────────────────

describe('FieldUISpec consolidated', () => {
  it('accepts a single FieldUISpec with fields from BOTH prior definitions', () => {
    // L36 set: display, formInput, link, colors, truncateLength, labelField
    // L274 set: filterable, sortable, filterType
    // Both must be assignable to the single consolidated FieldUISpec.
    const ui: FieldUISpec = {
      // L36 set
      display: 'badge',
      formInput: 'select',
      link: true,
      colors: { active: '#22c55e' },
      truncateLength: 50,
      labelField: 'name',
      // L274 set
      filterable: true,
      sortable: true,
      filterType: 'select',
    };

    // If the interface is consolidated, this assignment compiles and runs.
    expect(ui.filterable).toBe(true);
    expect(ui.sortable).toBe(true);
    expect(ui.filterType).toBe('select');
    expect(ui.display).toBe('badge');
    expect(ui.formInput).toBe('select');
  });

  it('accepts the new UI hints (section/showIf/cols/order/placeholder/helpText)', () => {
    const ui: FieldUISpec = {
      section: 'details',
      showIf: { hasCoupon: true },
      cols: 2,
      order: 3,
      placeholder: 'Enter code',
      helpText: 'Coupon applied at checkout',
    };

    expect(ui.section).toBe('details');
    expect(ui.cols).toBe(2);
    expect(ui.order).toBe(3);
    expect(ui.placeholder).toBe('Enter code');
    expect(ui.helpText).toBe('Coupon applied at checkout');
  });

  it('accepts showIf as a boolean', () => {
    const ui: FieldUISpec = { showIf: false };
    expect(ui.showIf).toBe(false);
  });

  it('accepts file hints multiple and accept', () => {
    const ui: FieldUISpec = {
      multiple: true,
      accept: 'image/*',
    };

    expect(ui.multiple).toBe(true);
    expect(ui.accept).toBe('image/*');
  });

  it('keeps all hints optional (omitted hints are non-breaking)', () => {
    const ui: FieldUISpec = {};
    expect(ui.section).toBeUndefined();
    expect(ui.showIf).toBeUndefined();
    expect(ui.cols).toBeUndefined();
    expect(ui.order).toBeUndefined();
    expect(ui.placeholder).toBeUndefined();
    expect(ui.helpText).toBeUndefined();
    expect(ui.multiple).toBeUndefined();
    expect(ui.accept).toBeUndefined();
    expect(ui.filterable).toBeUndefined();
    expect(ui.sortable).toBeUndefined();
    expect(ui.filterType).toBeUndefined();
    expect(ui.display).toBeUndefined();
    expect(ui.formInput).toBeUndefined();
  });
});

// ─── SpecValidator accepts new UI hints ─────────────────────────────────────

describe('SpecValidator accepts new UI hints', () => {
  it('validates a resource with all new UI hints without errors', () => {
    const resource = baseResource([
      {
        name: 'couponCode',
        type: 'string',
        ui: {
          section: 'discounts',
          showIf: { hasCoupon: true },
          cols: 2,
          order: 1,
          placeholder: 'CODE',
          helpText: 'Optional',
          // Also keep prior fields to ensure they still validate
          filterable: true,
          sortable: true,
          filterType: 'text',
          display: 'text',
          formInput: 'text',
        },
      },
    ]);

    const result = SpecValidator.validateAll([emptyLoaded(resource)]);

    expect(result.valid).toBe(true);
    expect(result.errors.some((e) => e.field === 'couponCode')).toBe(false);
  });

  it('validates a file field with multiple + accept ui hints', () => {
    const resource = baseResource([
      {
        name: 'attachments',
        type: 'file',
        ui: { multiple: true, accept: 'image/*' },
      },
    ]);

    const result = SpecValidator.validateAll([emptyLoaded(resource)]);

    expect(result.valid).toBe(true);
  });
});

// ─── FieldType password / secret ────────────────────────────────────────────

describe('FieldType password/secret', () => {
  it('SpecValidator accepts field type "password"', () => {
    const resource = baseResource([{ name: 'apiKey', type: 'password' }]);

    const result = SpecValidator.validateAll([emptyLoaded(resource)]);

    expect(result.valid).toBe(true);
    expect(
      result.errors.some(
        (e) => e.field === 'apiKey' && e.message.includes('Invalid field type'),
      ),
    ).toBe(false);
  });

  it('SpecValidator accepts field type "secret"', () => {
    const resource = baseResource([{ name: 'apiSecret', type: 'secret' }]);

    const result = SpecValidator.validateAll([emptyLoaded(resource)]);

    expect(result.valid).toBe(true);
    expect(
      result.errors.some(
        (e) =>
          e.field === 'apiSecret' && e.message.includes('Invalid field type'),
      ),
    ).toBe(false);
  });

  it('entity-factory treats password as a plain string column (no hashing)', () => {
    const resource = baseResource([
      { name: 'apiKey', type: 'password', length: 255 },
    ]);

    const result = EntityFactory.create(resource, new Map(), 'demo');

    expect(result.mainSchema).toBeDefined();
    const options = result.mainSchema.options as {
      columns: Record<string, { type: unknown; length?: number }>;
    };
    const col = options.columns.apiKey;
    expect(col).toBeDefined();
    // Plain string column — hashing is the auth module's downstream concern.
    // entity-factory.mapType falls through to `String` for password/secret.
    expect(col.type).toBe(String);
  });

  it('entity-factory treats secret as a plain string column (no hashing)', () => {
    const resource = baseResource([
      { name: 'apiSecret', type: 'secret', length: 255 },
    ]);

    const result = EntityFactory.create(resource, new Map(), 'demo');

    const options = result.mainSchema.options as {
      columns: Record<string, { type: unknown; length?: number }>;
    };
    const col = options.columns.apiSecret;
    expect(col).toBeDefined();
    expect(col.type).toBe(String);
  });
});

// ─── ChartType table / list ─────────────────────────────────────────────────

describe('ChartType table/list', () => {
  it('SpecValidator accepts a view panel with chart "table"', () => {
    const resource = baseResource([{ name: 'title', type: 'string' }]);
    const loaded = emptyLoaded(resource);
    loaded.spec.views = [
      {
        name: 'overview',
        type: 'dashboard',
        roles: ['admin'],
        panels: [
          {
            name: 'taskTable',
            chart: 'table',
            query: {
              resource: 'Issue',
              aggregate: 'count',
            },
          },
        ],
      },
    ];

    const result = SpecValidator.validateAll([loaded]);

    expect(
      result.errors.some(
        (e) =>
          e.message.includes('invalid chart') && e.message.includes('table'),
      ),
    ).toBe(false);
  });

  it('SpecValidator accepts a view panel with chart "list"', () => {
    const resource = baseResource([{ name: 'title', type: 'string' }]);
    const loaded = emptyLoaded(resource);
    loaded.spec.views = [
      {
        name: 'overview',
        type: 'dashboard',
        roles: ['admin'],
        panels: [
          {
            name: 'recentList',
            chart: 'list',
            query: {
              resource: 'Issue',
              aggregate: 'count',
            },
          },
        ],
      },
    ];

    const result = SpecValidator.validateAll([loaded]);

    expect(
      result.errors.some(
        (e) =>
          e.message.includes('invalid chart') && e.message.includes('list'),
      ),
    ).toBe(false);
  });

  it('still rejects unknown chart types', () => {
    const resource = baseResource([{ name: 'title', type: 'string' }]);
    const loaded = emptyLoaded(resource);
    loaded.spec.views = [
      {
        name: 'overview',
        type: 'dashboard',
        roles: ['admin'],
        panels: [
          {
            name: 'bogus',
            // Use an invalid chart type via any-cast to bypass TS at compile time
            chart: 'bogus' as unknown as never,
            query: { resource: 'Issue', aggregate: 'count' },
          },
        ],
      },
    ];

    const result = SpecValidator.validateAll([loaded]);

    expect(result.errors.some((e) => e.message.includes('invalid chart'))).toBe(
      true,
    );
  });
});

// ─── ResourceUISpec sections / steps / tabs ─────────────────────────────────

describe('ResourceUISpec sections/steps/tabs', () => {
  it('accepts sections array with title/icon/cols/fields', () => {
    const resource = baseResource([{ name: 'title', type: 'string' }]);
    resource.ui = {
      sections: [{ title: 'Basics', icon: 'info', cols: 2, fields: ['title'] }],
    };

    const result = SpecValidator.validateAll([emptyLoaded(resource)]);

    expect(result.valid).toBe(true);
  });

  it('accepts steps array with title/icon/fields/section', () => {
    const resource = baseResource([{ name: 'title', type: 'string' }]);
    resource.ui = {
      steps: [
        {
          title: 'Step 1',
          icon: 'play',
          fields: ['title'],
          section: 'intro',
        },
      ],
    };

    const result = SpecValidator.validateAll([emptyLoaded(resource)]);

    expect(result.valid).toBe(true);
  });

  it('accepts tabs array with title/icon/fields/section', () => {
    const resource = baseResource([{ name: 'title', type: 'string' }]);
    resource.ui = {
      tabs: [
        {
          title: 'Main',
          icon: 'tab',
          fields: ['title'],
          section: 'main',
        },
      ],
    };

    const result = SpecValidator.validateAll([emptyLoaded(resource)]);

    expect(result.valid).toBe(true);
  });

  it('accepts a resource with sections AND steps AND tabs set together', () => {
    const resource = baseResource([
      { name: 'title', type: 'string' },
      { name: 'desc', type: 'text' },
    ]);
    resource.ui = {
      sections: [{ title: 'Basics', fields: ['title'] }],
      steps: [{ title: 'Step 1', fields: ['title'] }],
      tabs: [{ title: 'Main', fields: ['desc'] }],
    };

    const result = SpecValidator.validateAll([emptyLoaded(resource)]);

    // The spec says: no error is raised when multiple are set — precedence
    // is a runtime (frontend) concern, not a validation error.
    expect(result.valid).toBe(true);
  });
});
