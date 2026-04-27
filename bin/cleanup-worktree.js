#!/usr/bin/env node
const { execSync } = require("child_process");
const { existsSync, rmSync } = require("fs");
const { resolve } = require("path");

const worktreeName = process.argv[2];
if (!worktreeName) {
  console.error("Usage: node bin/cleanup-worktree.js <worktree-name>");
  console.error("Example: node bin/cleanup-worktree.js task-42");
  process.exit(1);
}

const worktreePath = resolve(__dirname, "..", "worktrees", worktreeName);
const issueNumber = worktreeName.replace("task-", "");
const branchName = `feature/issue-${issueNumber}`;
const rootPath = resolve(__dirname, "..");

function run(cmd, opts = {}) {
  const options = { cwd: opts.cwd || rootPath, stdio: "inherit", ...opts };
  console.log(`  $ ${cmd}`);
  try { execSync(cmd, options); } catch { /* non-fatal */ }
}

console.log(`\n==> Cleaning up worktree: ${worktreeName}\n`);

// [1/2] Remove worktree directory
console.log("[1/2] Removing worktree...");
if (existsSync(worktreePath)) {
  try {
    run(`git worktree remove "${worktreePath}" --force`);
  } catch { /* may leave files behind */ }
  // Fallback: if directory still exists (node_modules, etc.), force-remove
  if (existsSync(worktreePath)) {
    try { rmSync(worktreePath, { recursive: true, force: true }); } catch {}
    run("git worktree prune");
  }
} else {
  console.log("  Directory not found, pruning...");
  run("git worktree prune");
}

// [2/2] Delete local branch
console.log(`[2/2] Deleting branch ${branchName}...`);
run(`git branch -D ${branchName}`);

console.log(`\n✅ Worktree ${worktreeName} cleaned up.\n`);
