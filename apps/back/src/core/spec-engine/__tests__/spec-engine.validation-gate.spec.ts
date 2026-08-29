/**
 * SpecEngineModule.spec register() — validation gate (D).
 *
 * The module must NOT materialize resources that carry validation errors;
 * clean resources in the same run still materialize. Mocks the factories
 * and spies on the registration calls.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Module-level mocks (hoisted by Vitest) ─────────────────────────────────

vi.mock('@src/core/spec-engine/entity-factory', () => ({
  EntityFactory: {
    create: vi.fn(() => ({
      mainSchema: { options: { name: 'mock' } },
      joinTableSchemas: [],
    })),
  },
}));

vi.mock('@src/core/spec-engine/controller-factory', () => ({
  ControllerFactory: {
    create: vi.fn(() => ({
      controllerClass: class MockController {},
      entitySchemaName: 'mock',
    })),
  },
}));

vi.mock('@src/core/spec-engine/spec-validator', () => {
  return {
    SpecValidator: {
      // Real signature: validateAll(loadedSpecs, options?) — errors injected
      // per-test via the mutable state below.
      validateAll: (loadedSpecs: unknown[]) =>
        mockValidatorState.validateAll(loadedSpecs),
    },
  };
});

vi.mock('@src/core/spec-engine/spec-job-runner', () => ({
  SpecJobRunner: {
    register: vi.fn(() => ({ imports: [], providers: [] })),
  },
}));

vi.mock('@src/core/spec-engine/webhook-controller-factory', () => ({
  WebhookControllerFactory: {
    create: vi.fn(() => ({ controllerClass: class MockWebhookCtrl {} })),
  },
}));

vi.mock('@src/core/spec-engine/spec-engine-action-factory', () => ({
  SpecEngineActionFactory: {
    create: vi.fn(() => null),
  },
}));

vi.mock('@src/core/spec-engine/hook-executor', () => ({
  HookExecutor: class {
    loadHook() {
      return null;
    }
    setErrorReporter() {
      /* noop */
    }
  },
}));

vi.mock('@src/core/spec-engine/notification-dispatcher', () => ({
  NotificationDispatcher: class {},
}));

vi.mock('@src/core/spec-engine/spec-error-reporter', () => ({
  SpecErrorReporter: class {},
}));

vi.mock('@src/core/spec-engine/foundation-entity-schemas', () => ({
  buildFoundationEntitySchemas: () => [],
}));

vi.mock('@src/core/spec-engine/spec-engine-audit', () => ({
  getAuditSchema: () => ({ options: { name: 'audit-mock' } }),
}));

vi.mock('@src/core/spec-engine/embed-service', () => ({
  EmbedService: class {},
}));

vi.mock('@src/core/spec-engine/spec-engine-boot', () => ({
  SpecEngineBootService: class {},
}));

vi.mock('@src/core/spec-engine/meta-controller', () => ({
  SpecMetaController: class {},
}));

vi.mock('@src/core/spec-engine/spec-engine-scheduled-actions', () => ({
  createSpecWebhookSubscriptionSchema: () => ({
    options: { name: 'sub-mock' },
  }),
}));

vi.mock('@infra/mailer/mailer.module', () => ({
  MailerModule: class {},
}));

vi.mock('@comms/mail/services/template-renderer.service', () => ({
  TemplateRenderer: class {},
}));

vi.mock('@nestjs/typeorm', () => ({
  TypeOrmModule: {
    forFeature: vi.fn(() => ({ module: class {}, providers: [] })),
  },
}));

vi.mock('@src/core/spec-engine/spec-loader', () => {
  return {
    SpecLoader: {
      // Real signature: load(extensionsDir) — resources injected per-test.
      load: () => mockSpecState.loaded,
    },
    // spec.types re-exports this type from spec-loader — keep the name
    // available for type-only consumers at runtime.
  };
});

// Mutable per-test spec state.
const mockSpecState: {
  loaded: Array<{ spec: unknown; dir: string; specPath: string }>;
} = {
  loaded: [],
};

// Mutable per-test validator state.
const mockValidatorState: {
  validateAll: (loadedSpecs: unknown[]) => {
    valid: boolean;
    errors: Array<{ resource?: string; message: string }>;
    warnings: Array<{ resource?: string; message: string }>;
  };
} = {
  validateAll: () => ({ valid: true, errors: [], warnings: [] }),
};

import { SpecEngineModule } from '@src/core/spec-engine/spec-engine.module';
import { ControllerFactory } from '@src/core/spec-engine/controller-factory';
import { EntityFactory } from '@src/core/spec-engine/entity-factory';

function loadedSpec(resources: Array<Record<string, unknown>>) {
  return {
    spec: {
      name: 'demo',
      version: '1.0.0',
      resources,
    },
    dir: '/tmp/demo',
    specPath: '/tmp/demo/demo.spec.yaml',
  };
}

function cleanResource(name: string) {
  return {
    name,
    table: `ext_demo_${name}`,
    fields: [{ name: 'title', type: 'string', required: true }],
  };
}

function brokenResource(name: string) {
  return {
    name,
    table: `ext_demo_${name}`,
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'bad', type: 'not-a-type' },
    ],
  };
}

describe('SpecEngineModule.register — validation gate (D)', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    (ControllerFactory.create as ReturnType<typeof vi.fn>).mockClear();
    (EntityFactory.create as ReturnType<typeof vi.fn>).mockClear();
    mockValidatorState.validateAll = () => ({
      valid: true,
      errors: [],
      warnings: [],
    });
    mockSpecState.loaded = [
      {
        spec: {
          name: 'demo',
          version: '1.0.0',
          resources: [cleanResource('goodRes')],
        },
        dir: '/tmp/demo',
        specPath: '/tmp/demo/demo.spec.yaml',
      },
    ];
  });

  it('should materialize all resources when validation passes', () => {
    try {
      SpecEngineModule.register();
      expect(EntityFactory.create).toHaveBeenCalledTimes(1);
      expect(ControllerFactory.create).toHaveBeenCalledTimes(1);
    } finally {
      /* no stubs to restore — load/validate are mocked at module level */
    }
  });

  it('should skip ONLY the resource that carries validation errors', () => {
    mockSpecState.loaded = [
      loadedSpec([cleanResource('goodRes'), brokenResource('badRes')]),
    ];
    mockValidatorState.validateAll = () => ({
      valid: false,
      errors: [
        { resource: 'badRes', message: 'Invalid field type "not-a-type"' },
      ],
      warnings: [],
    });

    try {
      SpecEngineModule.register();
      // badRes skipped; goodRes materialized.
      const materialized = (
        EntityFactory.create as ReturnType<typeof vi.fn>
      ).mock.calls.map((call) => (call[0] as { name: string }).name);
      expect(materialized).toEqual(['goodRes']);
      expect(materialized).not.toContain('badRes');
      expect(
        ControllerFactory.create as ReturnType<typeof vi.fn>,
      ).toHaveBeenCalledTimes(1);
      const created = (
        ControllerFactory.create as ReturnType<typeof vi.fn>
      ).mock.calls.map(
        (call) => (call[0] as { spec: { name: string } }).spec.name,
      );
      expect(created).toEqual(['goodRes']);
    } finally {
      /* module-level mocks */
    }
  });

  it('should not block clean resources when an unrelated resource has errors', () => {
    mockSpecState.loaded = [loadedSpec([cleanResource('goodRes')])];
    mockValidatorState.validateAll = () => ({
      valid: false,
      errors: [{ resource: 'other', message: 'something else entirely' }],
      warnings: [],
    });

    try {
      SpecEngineModule.register();
      expect(
        ControllerFactory.create as ReturnType<typeof vi.fn>,
      ).toHaveBeenCalled();
    } finally {
      /* module-level mocks */
    }
    void logSpy;
    void errorSpy;
  });
});
