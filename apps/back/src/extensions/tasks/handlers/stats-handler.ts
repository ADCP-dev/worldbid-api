/**
 * Stats Action Handler — `GET /tasks/stats`
 *
 * Aggregates task metrics for the dashboard:
 *   - byStatus: counts per status enum
 *   - byPriority: counts per priority enum
 *   - byAssignee: top 5 assignees by task count
 *   - throughput: tasks completed per day over the selected range
 *   - upcoming: tasks with dueDate in the next 7 days (not done)
 *   - overdue: tasks with dueDate in the past (not done)
 *
 * Loaded by `SpecEngineActionFactory`. Signature:
 *   (entityId: null, input: { range? }, ctx) => Promise<TaskStatsResponse>
 *
 * `range` is optional, one of '7d' | '30d' | '90d' (default '30d'). Only the
 * `throughput` window is affected by range; the other panels are point-in-time.
 *
 * Introduced by change `tasks-v2-professional` (Slice 3).
 */

import type { HookContext } from '@core/spec-engine/spec.types';

type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done' | 'blocked';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface TaskStatsResponse {
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  byAssignee: Array<{ id: number; name: string; count: number }>;
  throughput: Array<{ date: string; count: number }>;
  upcoming: Array<{ id: number; title: string; dueDate: string | null }>;
  overdue: Array<{ id: number; title: string; dueDate: string | null }>;
}

const STATUS_VALUES: TaskStatus[] = [
  'pending',
  'in_progress',
  'review',
  'done',
  'blocked',
];
const PRIORITY_VALUES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

const RANGE_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function rangeToDays(range: unknown): number {
  if (typeof range === 'string' && range in RANGE_DAYS) {
    return RANGE_DAYS[range];
  }
  return 30;
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function statsHandler(
  _entityId: number | null,
  input: Record<string, unknown>,
  ctx: HookContext,
): Promise<TaskStatsResponse> {
  const days = rangeToDays(input.range);
  const taskRepo = ctx.getRepository('task');

  const now = new Date();
  const throughputStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const upcomingStart = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // ── byStatus ──
  const statusRows: Array<{ status: string; cnt: string }> = await taskRepo
    .createQueryBuilder('task')
    .select('task.status', 'status')
    .addSelect('COUNT(*)', 'cnt')
    .where('task.deletedAt IS NULL')
    .groupBy('task.status')
    .getRawMany();
  const byStatus = Object.fromEntries(
    STATUS_VALUES.map((s) => [s, 0]),
  ) as Record<TaskStatus, number>;
  for (const row of statusRows) {
    if (row.status in byStatus) {
      byStatus[row.status as TaskStatus] = Number(row.cnt);
    }
  }

  // ── byPriority ──
  const priorityRows: Array<{ priority: string; cnt: string }> = await taskRepo
    .createQueryBuilder('task')
    .select('task.priority', 'priority')
    .addSelect('COUNT(*)', 'cnt')
    .where('task.deletedAt IS NULL')
    .groupBy('task.priority')
    .getRawMany();
  const byPriority = Object.fromEntries(
    PRIORITY_VALUES.map((p) => [p, 0]),
  ) as Record<TaskPriority, number>;
  for (const row of priorityRows) {
    if (row.priority in byPriority) {
      byPriority[row.priority as TaskPriority] = Number(row.cnt);
    }
  }

  // ── byAssignee (top 5) ──
  // Join user to get the name; fall back to assigneeId if user row missing.
  const assigneeRows: Array<{
    assigneeId: number;
    firstName: string | null;
    lastName: string | null;
    cnt: string;
  }> = await taskRepo
    .createQueryBuilder('task')
    .select('task.assigneeId', 'assigneeId')
    .addSelect('user.firstName', 'firstName')
    .addSelect('user.lastName', 'lastName')
    .addSelect('COUNT(*)', 'cnt')
    .leftJoin('user', 'user', 'user.id = task.assigneeId')
    .where('task.deletedAt IS NULL')
    .andWhere('task.assigneeId IS NOT NULL')
    .groupBy('task.assigneeId')
    .addGroupBy('user.firstName')
    .addGroupBy('user.lastName')
    .orderBy('cnt', 'DESC')
    .limit(5)
    .getRawMany();
  const byAssignee = assigneeRows.map((row) => {
    const name = [row.firstName, row.lastName]
      .filter((n): n is string => typeof n === 'string' && n.length > 0)
      .join(' ');
    return {
      id: Number(row.assigneeId),
      name: name || `User #${row.assigneeId}`,
      count: Number(row.cnt),
    };
  });

  // ── throughput: tasks done per day over the range ──
  const throughputRows: Array<{ day: string; cnt: string }> = await taskRepo
    .createQueryBuilder('task')
    .select("TO_CHAR(task.updatedAt, 'YYYY-MM-DD')", 'day')
    .addSelect('COUNT(*)', 'cnt')
    .where('task.deletedAt IS NULL')
    .andWhere('task.status = :status', { status: 'done' })
    .andWhere('task.updatedAt >= :start', { start: throughputStart })
    .groupBy("TO_CHAR(task.updatedAt, 'YYYY-MM-DD')")
    .orderBy('day', 'ASC')
    .getRawMany();
  const throughput = throughputRows.map((row) => ({
    date: row.day,
    count: Number(row.cnt),
  }));

  // ── upcoming: dueDate between now and now+7d, not done ──
  const upcomingRows: Array<{ id: number; title: string; dueDate: string | null }> =
    await taskRepo
      .createQueryBuilder('task')
      .select(['task.id AS id', 'task.title AS title', 'task.dueDate AS dueDate'])
      .where('task.deletedAt IS NULL')
      .andWhere('task.dueDate IS NOT NULL')
      .andWhere('task.dueDate >= :now', { now })
      .andWhere('task.dueDate <= :upcomingEnd', { upcomingEnd: upcomingStart })
      .andWhere('task.status != :doneStatus', { doneStatus: 'done' })
      .orderBy('task.dueDate', 'ASC')
      .limit(20)
      .getRawMany();
  const upcoming = upcomingRows.map((row) => ({
    id: Number(row.id),
    title: String(row.title),
    dueDate: row.dueDate,
  }));

  // ── overdue: dueDate < now, not done ──
  const overdueRows: Array<{ id: number; title: string; dueDate: string | null }> =
    await taskRepo
      .createQueryBuilder('task')
      .select(['task.id AS id', 'task.title AS title', 'task.dueDate AS dueDate'])
      .where('task.deletedAt IS NULL')
      .andWhere('task.dueDate IS NOT NULL')
      .andWhere('task.dueDate < :now', { now })
      .andWhere('task.status != :doneStatus', { doneStatus: 'done' })
      .orderBy('task.dueDate', 'ASC')
      .limit(50)
      .getRawMany();
  const overdue = overdueRows.map((row) => ({
    id: Number(row.id),
    title: String(row.title),
    dueDate: row.dueDate,
  }));

  return { byStatus, byPriority, byAssignee, throughput, upcoming, overdue };
}