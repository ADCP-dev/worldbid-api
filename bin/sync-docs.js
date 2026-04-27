#!/usr/bin/env node

/**
 * docs:sync — Auto-generates docs/ARCHITECTURE.md from YAML frontmatter in module docs.
 *
 * Scans docs/modules/, docs/extensions/, docs/custom/, docs/research/ for .md files,
 * parses YAML frontmatter, validates integrity, and generates a dependency diagram.
 *
 * Usage: node bin/sync-docs.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIRS = {
  modules: path.join(ROOT, "docs", "modules"),
  extensions: path.join(ROOT, "docs", "extensions"),
  custom: path.join(ROOT, "docs", "custom"),
  research: path.join(ROOT, "docs", "research"),
};

// ─── YAML Frontmatter Parser ────────────────────────────────────────────────

/**
 * Parses YAML frontmatter from a string.
 * Returns { id, name, type, parent, dependencies, conventions, entities, external_apis, aliases }
 * or null if no frontmatter found.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  const raw = match[1];
  const result = {};

  const lines = raw.split("\n");
  let currentListKey = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match key: value (simple scalar)
    const scalarMatch = line.match(/^(\w+):\s*(.+)$/);
    if (scalarMatch) {
      currentListKey = null;
      let [, key, val] = scalarMatch;
      val = val.trim();

      // Handle null
      if (val === "null" || val === "~") {
        result[key] = null;
        continue;
      }
      // Handle empty array []
      if (val === "[]") {
        result[key] = [];
        continue;
      }
      // Handle quoted string
      const qMatch = val.match(/^"(.*)"$/);
      if (qMatch) {
        result[key] = qMatch[1];
        continue;
      }
      // Handle array syntax
      if (val.startsWith("[")) {
        result[key] = val
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^"(.*)"$/, "$1"))
          .filter(Boolean);
        continue;
      }
      result[key] = val;
      continue;
    }

    // Match start of a list block (key: with value on next lines)
    const listStartMatch = line.match(/^(\w+):\s*$/);
    if (listStartMatch) {
      currentListKey = listStartMatch[1];
      if (!result[currentListKey]) {
        result[currentListKey] = [];
      }
      continue;
    }

    // Match list item:  - "value" or - value
    const itemMatch = line.match(/^\s*-\s+(?:"([^"]*)"|'([^']*)'|(.+))$/);
    if (itemMatch && currentListKey) {
      const val = itemMatch[1] || itemMatch[2] || itemMatch[3];
      if (val !== undefined && val.trim()) {
        result[currentListKey].push(val.trim());
      }
      continue;
    }

    // Continuation of previous list (indented line without dash)
    if (currentListKey && line.trim() && !line.match(/^\s*#/)) {
      // Nested list or continuation — skip for simplicity
      continue;
    }
  }

  return result;
}

// ─── Scan Files ─────────────────────────────────────────────────────────────

function scanDir(dirPath) {
  const entries = [];
  if (!fs.existsSync(dirPath)) return entries;

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    if (file === ".gitkeep") continue;
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isFile() && file.endsWith(".md")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const fm = parseFrontmatter(content);
      if (fm) {
        entries.push({ file, path: fullPath, fm });
      }
    }
  }
  return entries;
}

// ─── Validation ─────────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ["id", "type", "parent", "dependencies"];

function validate(modules, extensions, customDocs, researchDocs) {
  const errors = [];
  const allDocs = [...modules, ...extensions, ...customDocs, ...researchDocs];
  const allIds = new Set();
  const idSources = {}; // id → source file

  // Check required fields — null is valid for parent (top-level) and [] is valid for dependencies
  for (const doc of allDocs) {
    for (const field of REQUIRED_FIELDS) {
      if (doc.fm[field] === undefined) {
        errors.push(
          `[${doc.file}] Missing required field "${field}" in YAML frontmatter`
        );
      }
    }

    // Check for duplicate IDs
    const id = doc.fm.id;
    if (id) {
      if (allIds.has(id)) {
        errors.push(
          `[${doc.file}] Duplicate ID "${id}" (also used in ${idSources[id]})`
        );
      } else {
        allIds.add(id);
        idSources[id] = doc.file;
      }
    }
  }

  // Check parent references
  for (const doc of allDocs) {
    const parent = doc.fm.parent;
    if (parent !== undefined && parent !== null && parent !== "null") {
      if (!allIds.has(parent)) {
        errors.push(
          `[${doc.file}] parent "${parent}" does not match any existing document ID`
        );
      }
    }

    // Check dependencies
    const deps = doc.fm.dependencies || [];
    for (const dep of deps) {
      if (!allIds.has(dep)) {
        errors.push(
          `[${doc.file}] dependency "${dep}" does not match any existing document ID`
        );
      }
    }
  }

  return errors;
}

// ─── Mermaid Graph Generation ───────────────────────────────────────────────

function escapeMermaidId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function generateMermaid(modules, extensions) {
  const lines = ["graph TD"];

  // Module nodes
  for (const m of modules) {
    const id = escapeMermaidId(m.fm.id);
    const label = (m.fm.name || m.fm.id).replace(/"/g, "#quot;");
    lines.push(`  ${id}["${label}"]`);
  }

  // Extension nodes
  for (const ext of extensions) {
    const id = escapeMermaidId(ext.fm.id);
    const label = (ext.fm.name || ext.fm.id).replace(/"/g, "#quot;");
    lines.push(`  ${id}["${label}"]:::ext`);
  }

  // Dependency edges
  for (const m of modules) {
    const sourceId = escapeMermaidId(m.fm.id);
    const deps = m.fm.dependencies || [];
    for (const dep of deps) {
      const targetId = escapeMermaidId(dep);
      lines.push(`  ${sourceId} --> ${targetId}`);
    }
  }

  for (const ext of extensions) {
    const sourceId = escapeMermaidId(ext.fm.id);
    const parent = ext.fm.parent;
    if (parent !== undefined && parent !== null && parent !== "null") {
      const parentId = escapeMermaidId(parent);
      lines.push(`  ${sourceId} --> ${parentId}`);
    }
    const deps = ext.fm.dependencies || [];
    for (const dep of deps) {
      const targetId = escapeMermaidId(dep);
      lines.push(`  ${sourceId} --> ${targetId}`);
    }
  }

  // Style for extensions
  lines.push("");
  lines.push("  classDef ext fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;");

  return lines.join("\n");
}

// ─── Markdown Table Helpers ─────────────────────────────────────────────────

function modulesTable(modules) {
  const rows = [
    "| ID | Name | Dependencies | Entities |",
    "|----|------|--------------|----------|",
  ];
  for (const m of modules) {
    const deps = (m.fm.dependencies || []).join(", ") || "—";
    const entities = (m.fm.entities || []).join(", ") || "—";
    rows.push(`| \`${m.fm.id}\` | ${m.fm.name || m.fm.id} | ${deps} | ${entities} |`);
  }
  return rows.join("\n");
}

function extensionsTable(extensions) {
  const rows = [
    "| ID | Name | Parent | Dependencies |",
    "|----|------|--------|--------------|",
  ];
  for (const ext of extensions) {
    const parent = ext.fm.parent || "—";
    const deps = (ext.fm.dependencies || []).join(", ") || "—";
    rows.push(
      `| \`${ext.fm.id}\` | ${ext.fm.name || ext.fm.id} | ${parent} | ${deps} |`
    );
  }
  return rows.join("\n");
}

function customTable(customDocs) {
  const rows = [
    "| ID | Name | Dependencies |",
    "|----|------|--------------|",
  ];
  for (const doc of customDocs) {
    const deps = (doc.fm.dependencies || []).join(", ") || "—";
    rows.push(`| \`${doc.fm.id}\` | ${doc.fm.name || doc.fm.id} | ${deps} |`);
  }
  return rows.join("\n");
}

function researchList(researchDocs) {
  if (researchDocs.length === 0) return "None.";
  return researchDocs
    .map((d) => `- [${d.fm.name || d.fm.id}](${d.file})`)
    .join("\n");
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log("🔍 Scanning docs directories...");

  const modules = scanDir(DIRS.modules);
  const extensions = scanDir(DIRS.extensions);
  const customDocs = scanDir(DIRS.custom);
  const researchDocs = scanDir(DIRS.research);

  console.log(`   Found: ${modules.length} modules, ${extensions.length} extensions, ${customDocs.length} custom, ${researchDocs.length} research`);

  // Validate
  console.log("\n🔎 Validating...");
  const errors = validate(modules, extensions, customDocs, researchDocs);

  if (errors.length > 0) {
    console.error("\n❌ Validation FAILED:\n");
    for (const err of errors) {
      console.error(`  • ${err}`);
    }
    process.exit(1);
  }

  console.log("   ✓ All documents valid");

  // Generate ARCHITECTURE.md
  console.log("\n📄 Generating docs/ARCHITECTURE.md...");

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  const output = `# Foundation — Architecture Overview

> ⚡ Auto-generated by \`bin/sync-docs.js\` on ${timestamp} UTC.
> Edit individual docs in \`docs/modules/\`, \`docs/extensions/\`, \`docs/custom/\`, or \`docs/research/\` and re-run \`pnpm docs:sync\` to regenerate.

---

## Project Structure

\`\`\`
foundation/
├── apps/
│   ├── back/     # NestJS API
│   └── front/    # Nuxt 3 SPA
├── docs/         # Documentation
│   ├── modules/        # Core module documentation
│   ├── extensions/     # Extension documentation
│   ├── custom/         # Client-specific customizations
│   └── research/       # Research documents
└── docker-compose.yml
\`\`\`

---

## Module Registry

${modules.length > 0 ? modulesTable(modules) : "No modules registered."}

---

## Extensions

${extensions.length > 0 ? extensionsTable(extensions) : "No extensions registered."}

---

## Custom Documentation

${customDocs.length > 0 ? customTable(customDocs) : "No custom documents registered."}

---

## Research Documents

${researchDocs.length > 0 ? researchList(researchDocs) : "None."}

---

## Dependency Diagram

\`\`\`mermaid
${generateMermaid(modules, extensions)}
\`\`\`

---

## Related Documentation

### Module Docs (canonical)
${modules.map(m => `| [${m.fm.id}.md](./modules/${m.fm.id}.md) | ${m.fm.name || m.fm.id} |`).join("\n")}

### Extension Docs
${extensions.length > 0 ? extensions.map(e => `| [${e.fm.id}.md](./extensions/${e.fm.id}.md) | ${e.fm.name || e.fm.id} |`).join("\n") : "| (none) | — |"}

### Reference Docs
| File | Topic |
|------|-------|
| [FRONTEND-LAYERS.md](./FRONTEND-LAYERS.md) | Nuxt layers, middleware, auth store |
| [EXTENSIONS-SYSTEM.md](./EXTENSIONS-SYSTEM.md) | Dynamic extension modules |
| [GENERATORS.md](./GENERATORS.md) | Hygen CLI generators |
| [CREATE-EXTENSION.md](./CREATE-EXTENSION.md) | How to create an extension |
| [TYPESCRIPT-GUIDELINES.md](./TYPESCRIPT-GUIDELINES.md) | TypeScript conventions |
| [TOOLS.md](./TOOLS.md) | Tool catalog & reference |
`;

  const outPath = path.join(ROOT, "docs", "ARCHITECTURE.md");
  fs.writeFileSync(outPath, output, "utf-8");

  console.log(`   ✓ Written to ${path.relative(ROOT, outPath)}`);
  console.log("\n✅ Done — all validations passed.");
  process.exit(0);
}

main();
