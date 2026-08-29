/**
 * Join-table naming — single source of truth shared by the entity factory
 * (which CREATES the join-table EntitySchema) and the controller factory
 * (which looks the join table up by name at request time).
 *
 * History: the entity factory auto-named `ext_<extension>_<resource>_<field>`
 * while the controller factory looked up `ext_<spec.table>_<field>`, which
 * doubled the prefix (e.g. `ext_tasks_ext_tasks_task_tags` vs the real
 * `ext_tasks_task_tags`). Both sides must call THIS helper so they can never
 * disagree again.
 *
 * Semantics:
 *   - explicit `field.joinTable` always wins (existing override behavior).
 *   - otherwise: `ext_<extensionName>_<spec.name>_<field.name>` with the
 *     `ext_` prefix applied exactly once. When the extension name is
 *     missing, `ext_<spec.name>_<field.name>` (legacy `ext` prefix shape).
 */

import type { FieldSpec, ResourceSpec } from './spec.types';

export function joinTableName(
  extensionName: string | undefined,
  spec: ResourceSpec,
  field: FieldSpec,
): string {
  if (field.joinTable) return field.joinTable;
  const extPrefix = extensionName ? `ext_${extensionName}` : 'ext';
  return `${extPrefix}_${spec.name}_${field.name}`;
}