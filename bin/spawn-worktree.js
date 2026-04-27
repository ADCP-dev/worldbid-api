#!/usr/bin/env node
const { execSync } = require("child_process");
const { writeFileSync, existsSync, mkdirSync } = require("fs");
const { resolve, join, dirname } = require("path");

const issueNumber = process.argv[2];
if (!issueNumber || isNaN(Number(issueNumber))) {
  console.error("Usage: node bin/spawn-worktree.js <issue-number>");
  console.error("Example: node bin/spawn-worktree.js 42");
  process.exit(1);
}

const branchName = `feature/issue-${issueNumber}`;
const worktreeDir = `task-${issueNumber}`;
const worktreePath = resolve(__dirname, "..", "worktrees", worktreeDir);
const rootPath = resolve(__dirname, "..");

function run(cmd, opts = {}) {
  const options = { cwd: opts.cwd || rootPath, stdio: "inherit", ...opts };
  console.log(`  $ ${cmd}`);
  return execSync(cmd, options);
}

// Check prerequisites
try { execSync("gh auth status", { stdio: "pipe" }); } catch {
  console.error("❌ gh CLI not authenticated. Run: gh auth login");
  process.exit(1);
}

console.log(`\n==> Spawning worktree for Issue #${issueNumber}\n`);

// [1/5] Fetch
console.log("[1/5] Fetching origin...");
try { run("git fetch origin"); } catch {
  console.error("❌ git fetch failed. Check network.");
  process.exit(1);
}

// [2/5] Create branch
console.log(`[2/5] Creating branch ${branchName}...`);
try { run(`git branch ${branchName} origin/dev-cms`); } catch {
  console.log(`  Branch ${branchName} may already exist, continuing...`);
}

// [3/5] Create worktree
console.log(`[3/5] Creating worktree at ${worktreePath}...`);
try {
  const worktreesDir = dirname(worktreePath);
  if (!existsSync(worktreesDir)) mkdirSync(worktreesDir, { recursive: true });
  run(`git worktree add "${worktreePath}" ${branchName}`);
} catch {
  if (existsSync(worktreePath)) {
    console.log("  Worktree already exists, using it.");
  } else {
    console.error("❌ Failed to create worktree.");
    process.exit(1);
  }
}

// [4/5] Fetch issue content
console.log(`[4/5] Fetching issue #${issueNumber}...`);
let title, body;
try {
  title = execSync(`gh issue view ${issueNumber} --json title --jq .title`, { encoding: "utf-8" }).trim();
  body = execSync(`gh issue view ${issueNumber} --json body --jq .body`, { encoding: "utf-8" }).trim();
} catch {
  console.error(`❌ Could not fetch issue #${issueNumber}.`);
  process.exit(1);
}

const instructions = `# Task: ${title}
# Issue: #${issueNumber}
# Generated: ${new Date().toISOString().replace("T", " ").slice(0, 16)}

> Auto-generated from GitHub Issue #${issueNumber}.
> The AI agent reads this file to understand the task.

---

${body}
`;

writeFileSync(join(worktreePath, ".instructions.md"), instructions);
console.log("  ✅ .instructions.md written");

// [5/5] Install dependencies
console.log("[5/5] Installing dependencies...");
try {
  run("pnpm install --frozen-lockfile", { cwd: worktreePath });
  console.log("  ✅ Dependencies installed");
} catch {
  console.log("  ⚠️  pnpm install had issues. Run manually if needed.");
}

console.log(`\n✅ Worktree ready!`);
console.log(`   Path:   ${worktreePath}`);
console.log(`   Branch: ${branchName}`);
console.log(`   Issue:  #${issueNumber} — ${title}`);
console.log(`\nNext: Open a new OpenCode terminal in ${worktreePath}`);
