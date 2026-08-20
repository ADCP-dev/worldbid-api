import { describe, it, expect, vi } from 'vitest';
import { TriggerFactory } from '../trigger-factory';
import type { ResourceSpec, RealtimeSpec } from '../spec.types';

describe('TriggerFactory', () => {
  const baseSpec = (
    realtime: RealtimeSpec | undefined,
    fields: ResourceSpec['fields'] = [
      { name: 'title', type: 'string' },
      { name: 'status', type: 'string' },
    ],
  ): ResourceSpec => ({
    name: 'task',
    table: 'ext_tasks_task',
    fields,
    realtime,
    timestamps: false,
    softDelete: false,
  });

  describe('spec sin realtime', () => {
    it('devuelve array vacío cuando realtime undefined', () => {
      const spec = baseSpec(undefined);
      const statements = TriggerFactory.create(spec);
      expect(statements).toEqual([]);
    });
  });

  describe('payload id (default)', () => {
    it('genera CREATE FUNCTION + CREATE TRIGGER con payload id', () => {
      const spec = baseSpec({ events: ['insert', 'update', 'delete'] });
      const statements = TriggerFactory.create(spec);

      expect(statements.length).toBeGreaterThanOrEqual(2);

      const fnStatement = statements.find((s) =>
        s.up.includes('CREATE OR REPLACE FUNCTION'),
      );
      expect(fnStatement).toBeDefined();
      expect(fnStatement!.up).toContain('notify_task');
      expect(fnStatement!.up).toContain("pg_notify('task'");
      expect(fnStatement!.up).toContain("'event', TG_OP");
      expect(fnStatement!.up).toContain("'resource', 'task'");
      expect(fnStatement!.up).toContain("'id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END");
      expect(fnStatement!.up).not.toContain("'data'");

      const triggerStatement = statements.find((s) =>
        s.up.includes('CREATE TRIGGER'),
      );
      expect(triggerStatement).toBeDefined();
      expect(triggerStatement!.up).toContain('task_realtime_notify');
      expect(triggerStatement!.up).toContain('AFTER INSERT OR UPDATE OR DELETE');
      expect(triggerStatement!.up).toContain('ext_tasks_task');
      expect(triggerStatement!.up).toContain('FOR EACH ROW');
    });

    it('down migration tiene DROP TRIGGER + DROP FUNCTION', () => {
      const spec = baseSpec({ events: ['insert', 'update', 'delete'] });
      const statements = TriggerFactory.create(spec);

      const downParts = statements.map((s) => s.down);
      expect(downParts.some((d) => d.includes('DROP TRIGGER'))).toBe(true);
      expect(downParts.some((d) => d.includes('DROP FUNCTION'))).toBe(true);
    });
  });

  describe('canal custom', () => {
    it('usa channel del spec cuando declarado', () => {
      const spec = baseSpec({
        events: ['insert'],
        channel: 'tasks_channel',
      });
      const statements = TriggerFactory.create(spec);

      const fnStatement = statements.find((s) =>
        s.up.includes('CREATE OR REPLACE FUNCTION'),
      )!;
      expect(fnStatement.up).toContain('notify_tasks_channel');
      expect(fnStatement.up).toContain("pg_notify('tasks_channel'");
    });
  });

  describe('payload full', () => {
    it('genera jsonb_build_object con campos seguros (excluye password/secret/file)', () => {
      const spec = baseSpec(
        { events: ['insert', 'update'], payload: 'full' },
        [
          { name: 'title', type: 'string' },
          { name: 'apiKey', type: 'secret' },
          { name: 'password', type: 'password' },
          { name: 'attachment', type: 'file' },
          { name: 'status', type: 'string' },
        ],
      );
      const statements = TriggerFactory.create(spec);

      const fnStatement = statements.find((s) =>
        s.up.includes('CREATE OR REPLACE FUNCTION'),
      )!;
      expect(fnStatement.up).toContain("'title', NEW.title");
      expect(fnStatement.up).toContain("'status', NEW.status");
      expect(fnStatement.up).not.toContain("'apiKey'");
      expect(fnStatement.up).not.toContain("'password'");
      expect(fnStatement.up).not.toContain("'attachment'");
      expect(fnStatement.up).toContain("'data', safe_data");
    });

    it('DELETE con payload full envía data null', () => {
      const spec = baseSpec(
        { events: ['delete'], payload: 'full' },
        [{ name: 'title', type: 'string' }],
      );
      const statements = TriggerFactory.create(spec);

      const fnStatement = statements.find((s) =>
        s.up.includes('CREATE OR REPLACE FUNCTION'),
      )!;
      expect(fnStatement.up).toContain("TG_OP = 'DELETE'");
      expect(fnStatement.up).toContain("'data', null");
    });
  });

  describe('payload diff', () => {
    it('UPDATE genera diff con jsonb_object_agg', () => {
      const spec = baseSpec(
        { events: ['update'], payload: 'diff' },
        [
          { name: 'title', type: 'string' },
          { name: 'status', type: 'string' },
        ],
      );
      const statements = TriggerFactory.create(spec);

      const fnStatement = statements.find((s) =>
        s.up.includes('CREATE OR REPLACE FUNCTION'),
      )!;
      expect(fnStatement.up).toContain('jsonb_object_agg');
      expect(fnStatement.up).toContain('jsonb_each');
      expect(fnStatement.up).toContain('IS DISTINCT FROM');
      expect(fnStatement.up).toContain("'changes'");
    });

    it('INSERT con diff envía data full', () => {
      const spec = baseSpec(
        { events: ['insert'], payload: 'diff' },
        [{ name: 'title', type: 'string' }],
      );
      const statements = TriggerFactory.create(spec);

      const fnStatement = statements.find((s) =>
        s.up.includes('CREATE OR REPLACE FUNCTION'),
      )!;
      expect(fnStatement.up).toContain("TG_OP = 'INSERT'");
      expect(fnStatement.up).toContain("'data', to_jsonb(NEW)");
    });
  });

  describe('events filter', () => {
    it('solo genera trigger para eventos declarados', () => {
      const spec = baseSpec({ events: ['insert'] });
      const statements = TriggerFactory.create(spec);

      const triggerStatement = statements.find((s) =>
        s.up.includes('CREATE TRIGGER'),
      )!;
      expect(triggerStatement.up).toContain('AFTER INSERT');
      expect(triggerStatement.up).not.toContain('UPDATE');
      expect(triggerStatement.up).not.toContain('DELETE');
    });
  });

  describe('warning entidad grande', () => {
    it('emite warning si >10 campos safe con payload full', () => {
      const manyFields = Array.from({ length: 12 }, (_, i) => ({
        name: `field${i}`,
        type: 'string' as const,
      }));
      const spec = baseSpec(
        { events: ['insert'], payload: 'full' },
        manyFields,
      );

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      TriggerFactory.create(spec);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('no emite warning si <=10 campos con payload full', () => {
      const fewFields = Array.from({ length: 8 }, (_, i) => ({
        name: `field${i}`,
        type: 'string' as const,
      }));
      const spec = baseSpec(
        { events: ['insert'], payload: 'full' },
        fewFields,
      );

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      TriggerFactory.create(spec);
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('drop', () => {
    it('genera DROP TRIGGER + DROP FUNCTION para realtime removido', () => {
      const spec = baseSpec({ events: ['insert'], channel: 'tasks' });
      const statements = TriggerFactory.drop(spec, { events: ['insert'], channel: 'tasks' });

      expect(statements.length).toBeGreaterThanOrEqual(2);
      expect(statements.some((s) => s.up.includes('DROP TRIGGER'))).toBe(true);
      expect(statements.some((s) => s.up.includes('DROP FUNCTION'))).toBe(true);
    });
  });
});