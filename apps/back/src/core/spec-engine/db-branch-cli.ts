#!/usr/bin/env ts-node
/**
 * db-branch-cli — CLI for PostgreSQL schema-level branching.
 *
 * Usage:
 *   pnpm db:branch:create -- --name=test-x [--copy-data] [--parent=staging]
 *   pnpm db:branch:list [--json]
 *   pnpm db:branch:discard -- --name=test-x
 *   pnpm db:branch:merge -- --name=test-x
 *   pnpm db:branch:cleanup [--max-age-hours=48]
 *
 * Exit codes: 0 success, 1 error (message to stderr).
 *
 * @see prds/agent-native/04-database-branching.md
 */
import { AppDataSource } from '@src/infrastructure/database/data-source';
import { DbBranchManager } from '@src/core/spec-engine/db-branch-manager';

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const body = arg.slice(2);
      const eq = body.indexOf('=');
      if (eq !== -1) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else {
        flags[body] = true;
      }
    }
  }
  return flags;
}

function printUsage(): void {
  console.error(`Usage:
  db-branch-cli create [--name=X] [--copy-data] [--parent=Y]
  db-branch-cli list [--json]
  db-branch-cli discard --name=X
  db-branch-cli merge --name=X
  db-branch-cli cleanup [--max-age-hours=N]`);
}

export async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const subcommand = args.find((a) => !a.startsWith('--'));
  const flags = parseArgs(args);

  if (!subcommand) {
    printUsage();
    process.exit(1);
    return;
  }

  const manager = new DbBranchManager(AppDataSource as never);

  try {
    if (subcommand === 'create') {
      const branch = await manager.createBranch({
        name: typeof flags.name === 'string' ? flags.name : undefined,
        copyData: flags['copy-data'] === true,
        parentSchema:
          typeof flags.parent === 'string' ? flags.parent : undefined,
      });
      console.log(
        `✓ Branch created: ${branch.name} (schema: ${branch.schema})`,
      );
      process.exit(0);
      return;
    }

    if (subcommand === 'list') {
      const branches = await manager.listBranches();
      if (flags.json === true) {
        console.log(JSON.stringify(branches, null, 2));
      } else if (branches.length === 0) {
        console.log('No branches found.');
      } else {
        for (const b of branches) {
          console.log(
            `  ${b.name}  schema=${b.schema}  status=${b.status}  by=${b.createdBy}  at=${b.createdAt}`,
          );
        }
      }
      process.exit(0);
      return;
    }

    if (subcommand === 'discard') {
      const name = typeof flags.name === 'string' ? flags.name : '';
      if (!name) {
        console.error('Error: --name is required for discard');
        process.exit(1);
        return;
      }
      const branches = await manager.listBranches();
      const target = branches.find((b) => b.name === name);
      if (!target) {
        console.error(`Error: branch '${name}' not found`);
        process.exit(1);
        return;
      }
      await manager.discardBranch(target);
      console.log(`✓ Branch discarded: ${name}`);
      process.exit(0);
      return;
    }

    if (subcommand === 'merge') {
      const name = typeof flags.name === 'string' ? flags.name : '';
      if (!name) {
        console.error('Error: --name is required for merge');
        process.exit(1);
        return;
      }
      const branches = await manager.listBranches();
      const target = branches.find((b) => b.name === name);
      if (!target) {
        console.error(`Error: branch '${name}' not found`);
        process.exit(1);
        return;
      }
      await manager.mergeBranch(target);
      console.log(`✓ Branch merged: ${name}`);
      process.exit(0);
      return;
    }

    if (subcommand === 'cleanup') {
      const maxAge =
        typeof flags['max-age-hours'] === 'string'
          ? parseInt(flags['max-age-hours'], 10)
          : 24;
      const count = await manager.cleanupStale(maxAge);
      console.log(`✓ Cleaned up ${count} stale branch(es) (>${maxAge}h)`);
      process.exit(0);
      return;
    }

    console.error(`Unknown subcommand: ${subcommand}`);
    printUsage();
    process.exit(1);
  } catch (err) {
    console.error(`\n❌ ${(err as Error).message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  void runCli();
}
