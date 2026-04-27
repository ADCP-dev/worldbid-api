#!/usr/bin/env node
const { execSync } = require("child_process");
const { existsSync } = require("fs");
const { join } = require("path");
const os = require("os");

const vaultPath = process.argv[2] || join(os.homedir(), "Documents", "Obsidian", "Empresa");
const rootDir = join(__dirname, "..");

console.log("==> Syncing Obsidian vault...");
console.log(`    Vault: ${vaultPath}`);

if (!existsSync(vaultPath)) {
  console.error(`❌ Obsidian vault not found at: ${vaultPath}`);
  console.error("   Usage: node bin/sync-obsidian.js [path-to-vault]");
  process.exit(1);
}

try {
  console.log("==> Indexing Obsidian vault...");
  execSync(`graphify "${vaultPath}" --no-viz --out graphify-out/obsidian`, {
    cwd: rootDir, stdio: "inherit",
  });

  console.log("==> Merging with project graph...");
  execSync(
    "graphify merge-graphs graphify-out/graph.json graphify-out/obsidian/graph.json --out graphify-out/graph.json",
    { cwd: rootDir, stdio: "inherit" }
  );

  console.log("✅ Unified graph ready at graphify-out/graph.json");
} catch (e) {
  console.error("❌ Graphify sync failed. Is graphify installed? Run: uv tool install graphifyy");
  process.exit(1);
}
