/**
 * useKanbanMapping — bridge between the Tasks spec-engine DTOs and the base
 * Kanban component types (modules/base/ui-app/components/kanban).
 *
 * toKanbanStates()      → the 5 fixed board columns (order 0..4 + colors).
 * taskColumnStyles()    → per-column theme (header/border/bg DaisyUI classes).
 * toKanbanTask()        → SpecTask → KanbanTask (stateId = status, priority
 *                         urgent → high + red 'urgent' tag, deterministic tag
 *                         colors, assignee resolved from the user directory).
 * positionsFromOrder()  → contiguous { id, position } items for the reorder
 *                         action payload (PATCH /tasks/reorder).
 */
import type {
  KanbanColumnStyleConfig,
  KanbanStateConfig,
  KanbanTag,
  KanbanTask,
} from '@base/ui-app/components/kanban/types';
import type { SpecTask, TaskStatus, UserLight } from '../types';

/** Adapter: users directory rows → the light user shape the components expect. */
export function toUserLight(
  users: Array<{ id: number; firstName: string | null; lastName: string | null; email: string; role?: { name?: string } | null; photo?: { path?: string } | null }>,
): UserLight[] {
  return users.map((u) => ({
    id: u.id,
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
    email: u.email,
    role: u.role?.name ? { name: u.role.name } : undefined,
    photo: u.photo?.path ? { path: u.photo.path } : null,
  }));
}

const BOARD_STATES: Array<{ id: TaskStatus; order: number; color: string }> = [
  { id: 'pending', order: 0, color: 'neutral' },
  { id: 'in_progress', order: 1, color: 'info' },
  { id: 'review', order: 2, color: 'warning' },
  { id: 'done', order: 3, color: 'success' },
  { id: 'blocked', order: 4, color: 'error' },
];

/** Column theming via Kanban `stateConfig` (no named slots needed). */
const COLUMN_STYLES: KanbanColumnStyleConfig = {
  pending: {
    headerClass: 'text-base-content/80',
    borderClass: 'border-base-300',
    bgClass: 'bg-base-200/40',
  },
  in_progress: {
    headerClass: 'text-info',
    borderClass: 'border-info/30',
    bgClass: 'bg-info/5',
  },
  review: {
    headerClass: 'text-warning',
    borderClass: 'border-warning/30',
    bgClass: 'bg-warning/5',
  },
  done: {
    headerClass: 'text-success',
    borderClass: 'border-success/30',
    bgClass: 'bg-success/5',
  },
  blocked: {
    headerClass: 'text-error',
    borderClass: 'border-error/30',
    bgClass: 'bg-error/5',
  },
};

/** DaisyUI badge classes used as the deterministic tag palette. */
const TAG_COLORS = [
  'badge-primary',
  'badge-secondary',
  'badge-accent',
  'badge-info',
  'badge-success',
  'badge-warning',
  'badge-error',
  'badge-neutral',
] as const;

/** Small deterministic string hash (DJB2-ish, unsigned). */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministic badge class for a tag label — same label → same color. */
export function tagColorFor(label: string): string {
  return TAG_COLORS[hashString(label) % TAG_COLORS.length] ?? 'badge-neutral';
}

/** Normalize the JSON tags column to a plain string[] regardless of shape. */
export function normalizeTags(tags: SpecTask['tags']): string[] {
  if (Array.isArray(tags)) {
    return tags.filter((t): t is string => typeof t === 'string');
  }
  if (tags && typeof tags === 'object') {
    // Legacy dictionary form: keep string values as labels.
    return Object.values(tags).filter(
      (v): v is string => typeof v === 'string',
    );
  }
  return [];
}

/**
 * The 5 fixed board states. `titleFor` maps a status to its label — pass
 * `(id) => t(\`ext.tasks.status.${id}\`)` from setup so titles stay reactive
 * to the active locale (useI18n cannot be called inside computed getters).
 */
export function toKanbanStates(
  titleFor: (status: TaskStatus) => string,
): KanbanStateConfig[] {
  return BOARD_STATES.map((state) => ({
    id: state.id,
    title: titleFor(state.id),
    order: state.order,
    color: state.color,
  }));
}

export function taskColumnStyles(): KanbanColumnStyleConfig {
  return COLUMN_STYLES;
}

function resolveAssignee(
  assigneeId: number | null | undefined,
  users: Array<{ id: number; firstName: string | null; lastName: string | null; email: string; role?: { name?: string } | null; photo?: { path?: string } | null }>,
): KanbanTask['assignee'] {
  if (assigneeId == null) return undefined;
  const user = users.find((u) => u.id === assigneeId);
  const fallback = `#${assigneeId}`;
  const name = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || fallback
    : fallback;
  return {
    id: String(assigneeId),
    name,
    email: user?.email ?? '',
    role: user?.role?.name ?? '',
    avatarUrl: user?.photo?.path ?? undefined,
  };
}

export function toKanbanTask(
  task: SpecTask,
  users: Array<{ id: number; firstName: string | null; lastName: string | null; email: string; role?: { name?: string } | null; photo?: { path?: string } | null }> = [],
): KanbanTask {
  const tags: KanbanTag[] = normalizeTags(task.tags).map((label) => ({
    id: label,
    label,
    color: tagColorFor(label),
  }));
  if (task.priority === 'urgent') {
    tags.unshift({ id: 'urgent', label: 'urgent', color: 'badge-error' });
  }
  return {
    id: String(task.id),
    title: task.title,
    description: task.description ?? undefined,
    stateId: task.status,
    priority: task.priority === 'urgent' ? 'high' : task.priority,
    tags: tags.length > 0 ? tags : undefined,
    assignee: resolveAssignee(task.assigneeId, users),
    dueDate: task.dueDate ?? undefined,
    order: task.position,
  };
}

/**
 * Contiguous positions for the final visual order of a column after a drop,
 * producing the `PATCH /tasks/reorder` payload items.
 */
export function positionsFromOrder(
  columnTasks: Array<{ id: string | number }>,
): Array<{ id: number; position: number }> {
  return columnTasks.map((t, index) => ({ id: Number(t.id), position: index }));
}
