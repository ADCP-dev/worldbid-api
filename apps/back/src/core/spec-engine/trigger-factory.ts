import type { ResourceSpec, FieldSpec, RealtimeSpec } from './spec.types';
import type { MigrationStatement } from './migration-generator';

const EXCLUDED_FIELD_TYPES = new Set(['password', 'secret', 'file']);

export class TriggerFactory {
  static create(spec: ResourceSpec): MigrationStatement[] {
    if (!spec.realtime) return [];
    return this.buildCreateStatements(spec, spec.realtime);
  }

  static drop(spec: ResourceSpec, realtime: RealtimeSpec): MigrationStatement[] {
    return this.buildDropStatements(spec, realtime);
  }

  private static buildCreateStatements(
    spec: ResourceSpec,
    realtime: RealtimeSpec,
  ): MigrationStatement[] {
    const channel = realtime.channel ?? spec.name;
    const fnName = `notify_${channel}`;
    const triggerName = `${channel}_realtime_notify`;
    const payloadMode = realtime.payload ?? 'id';
    const events = realtime.events;

    if (payloadMode === 'full') {
      this.warnIfLarge(spec);
    }

    const fnBody = this.buildFunctionBody(spec, channel, payloadMode, events);
    const fnStatement: MigrationStatement = {
      up: `CREATE OR REPLACE FUNCTION "${fnName}"() RETURNS trigger AS $$\n${fnBody}\n$$ LANGUAGE plpgsql`,
      down: `DROP FUNCTION IF EXISTS "${fnName}"()`,
      description: `Create realtime notify function for ${spec.table} (channel: ${channel})`,
    };

    const eventsClause = events.map((e) => e.toUpperCase()).join(' OR ');
    const triggerStatement: MigrationStatement = {
      up: `CREATE TRIGGER "${triggerName}" AFTER ${eventsClause} ON "${spec.table}" FOR EACH ROW EXECUTE FUNCTION "${fnName}"()`,
      down: `DROP TRIGGER IF EXISTS "${triggerName}" ON "${spec.table}"`,
      description: `Create realtime trigger for ${spec.table} (channel: ${channel})`,
    };

    return [fnStatement, triggerStatement];
  }

  private static buildDropStatements(
    spec: ResourceSpec,
    realtime: RealtimeSpec,
  ): MigrationStatement[] {
    const channel = realtime.channel ?? spec.name;
    const fnName = `notify_${channel}`;
    const triggerName = `${channel}_realtime_notify`;

    return [
      {
        up: `DROP TRIGGER IF EXISTS "${triggerName}" ON "${spec.table}"`,
        down: `CREATE TRIGGER "${triggerName}" AFTER ${realtime.events
          .map((e) => e.toUpperCase())
          .join(' OR ')} ON "${spec.table}" FOR EACH ROW EXECUTE FUNCTION "${fnName}"()`,
        description: `Drop realtime trigger for ${spec.table}`,
      },
      {
        up: `DROP FUNCTION IF EXISTS "${fnName}"()`,
        down: '',
        description: `Drop realtime notify function for ${spec.table}`,
      },
    ];
  }

  private static buildFunctionBody(
    spec: ResourceSpec,
    channel: string,
    payloadMode: 'id' | 'full' | 'diff',
    events: string[],
  ): string {
    const resource = spec.name;

    if (payloadMode === 'id') {
      return this.buildIdPayloadBody(resource, channel, events);
    }
    if (payloadMode === 'full') {
      return this.buildFullPayloadBody(spec, resource, channel, events);
    }
    return this.buildDiffPayloadBody(resource, channel, events);
  }

  private static buildIdPayloadBody(
    resource: string,
    channel: string,
    events: string[],
  ): string {
    const hasDelete = events.includes('delete');
    const idExpr = hasDelete
      ? 'CASE WHEN TG_OP = \'DELETE\' THEN OLD.id ELSE NEW.id END'
      : 'NEW.id';

    return `BEGIN
  PERFORM pg_notify('${channel}', jsonb_build_object(
    'event', TG_OP,
    'resource', '${resource}',
    'id', ${idExpr}
  )::text);
  RETURN NEW;
END`;
  }

  private static buildFullPayloadBody(
    spec: ResourceSpec,
    resource: string,
    channel: string,
    events: string[],
  ): string {
    const hasDelete = events.includes('delete');
    const safeFields = this.buildSafeFields(spec);
    const buildObjectParts = safeFields
      .map((f) => `'${f}', NEW.${f}`)
      .join(', ');

    const deleteBlock = hasDelete
      ? `  IF TG_OP = 'DELETE' THEN
    PERFORM pg_notify('${channel}', jsonb_build_object(
      'event', TG_OP,
      'resource', '${resource}',
      'id', OLD.id,
      'data', null
    )::text);
    RETURN OLD;
  END IF;
`
      : '';

    return `BEGIN
${deleteBlock}  DECLARE
    safe_data jsonb;
  BEGIN
    safe_data := jsonb_build_object(${buildObjectParts});
    PERFORM pg_notify('${channel}', jsonb_build_object(
      'event', TG_OP,
      'resource', '${resource}',
      'id', NEW.id,
      'data', safe_data
    )::text);
  END;
  RETURN NEW;
END`;
  }

  private static buildDiffPayloadBody(
    resource: string,
    channel: string,
    events: string[],
  ): string {
    const hasUpdate = events.includes('update');
    const hasInsert = events.includes('insert');
    const hasDelete = events.includes('delete');

    const blocks: string[] = [];

    if (hasUpdate) {
      blocks.push(`  IF TG_OP = 'UPDATE' THEN
    DECLARE
      changes jsonb;
    BEGIN
      SELECT jsonb_object_agg(key, value) INTO changes
      FROM jsonb_each(to_jsonb(NEW))
      WHERE to_jsonb(OLD) -> key IS DISTINCT FROM to_jsonb(NEW) -> key;
      PERFORM pg_notify('${channel}', jsonb_build_object(
        'event', TG_OP,
        'resource', '${resource}',
        'id', NEW.id,
        'changes', COALESCE(changes, '{}'::jsonb)
      )::text);
    END;
    RETURN NEW;
  END IF;`);
    }

    if (hasInsert) {
      blocks.push(`  IF TG_OP = 'INSERT' THEN
    PERFORM pg_notify('${channel}', jsonb_build_object(
      'event', TG_OP,
      'resource', '${resource}',
      'id', NEW.id,
      'data', to_jsonb(NEW)
    )::text);
    RETURN NEW;
  END IF;`);
    }

    if (hasDelete) {
      blocks.push(`  IF TG_OP = 'DELETE' THEN
    PERFORM pg_notify('${channel}', jsonb_build_object(
      'event', TG_OP,
      'resource', '${resource}',
      'id', OLD.id
    )::text);
    RETURN OLD;
  END IF;`);
    }

    return `BEGIN\n${blocks.join('\n')}\nEND`;
  }

  private static buildSafeFields(spec: ResourceSpec): string[] {
    const safe: string[] = ['id'];
    for (const field of spec.fields) {
      if (EXCLUDED_FIELD_TYPES.has(field.type)) continue;
      if (field.type === 'computed' || field.type === 'many-to-many') continue;
      safe.push(field.name);
    }
    if (spec.timestamps !== false) {
      safe.push('createdAt');
      safe.push('updatedAt');
    }
    return safe;
  }

  private static warnIfLarge(spec: ResourceSpec): void {
    const safeCount = spec.fields.filter(
      (f) => !EXCLUDED_FIELD_TYPES.has(f.type) && f.type !== 'computed' && f.type !== 'many-to-many',
    ).length;
    const hasLargeFields = spec.fields.some(
      (f) => f.type === 'text' || f.type === 'json',
    );
    if (safeCount > 10 || hasLargeFields) {
      // eslint-disable-next-line no-console
      console.warn(
        `[TriggerFactory] Warning: resource "${spec.name}" has ${safeCount} safe fields` +
          (hasLargeFields ? ' with text/json fields' : '') +
          ' and payload "full". pg_notify has an 8KB limit. Consider using payload "id".',
      );
    }
  }
}