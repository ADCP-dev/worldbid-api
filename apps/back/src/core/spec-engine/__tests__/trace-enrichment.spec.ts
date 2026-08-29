/**
 * Trace enrichment — verifies each spec-engine pipeline file builds a
 * SpecTrace with the correct `layer` field when reporting errors (PRD 01,
 * Phase 3).
 *
 * The trace enrichment is additive: each catch block that reports an
 * error via SpecErrorReporter should construct a SpecTrace carrying
 * `layer`, `handlerFile`, `handlerFunction` and `input` so the resulting
 * ActionableError localizes the failure. We assert against the source
 * files (deterministic, no DB / NestJS runtime required) that each
 * pipeline layer references its expected `layer` literal.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const specEngineDir = resolve(__dirname, '..');

function source(file: string): string {
  return readFileSync(resolve(specEngineDir, file), 'utf-8');
}

const expectedLayers: Array<{ file: string; layer: string }> = [
  { file: 'hook-executor.ts', layer: 'hook_executor' },
  { file: 'spec-job-runner.ts', layer: 'job_runner' },
  { file: 'controller-factory.ts', layer: 'controller_factory' },
  { file: 'spec-engine-action-factory.ts', layer: 'action_factory' },
  { file: 'notification-dispatcher.ts', layer: 'notification_dispatcher' },
  { file: 'webhook-controller-factory.ts', layer: 'webhook_controller' },
  { file: 'spec-engine-boot.ts', layer: 'spec_engine_boot' },
  { file: 'spec-loader.ts', layer: 'spec_loader' },
];

describe('Trace enrichment — SpecTrace.layer per pipeline file', () => {
  for (const { file, layer } of expectedLayers) {
    it(`${file} references layer '${layer}'`, () => {
      const src = source(file);
      expect(src).toContain(`layer: '${layer}'`);
    });
  }

  it('role-registry.ts references layer permission_guard', () => {
    const src = source('role-registry.ts');
    expect(src).toContain("layer: 'permission_guard'");
  });
});
