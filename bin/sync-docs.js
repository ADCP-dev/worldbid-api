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
const os = require("os");

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

  const raw = match[1].replace(/\r\n/g, "\n");
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

// ─── Manifest Parent Scanner ────────────────────────────────────────────────

/**
 * Scan extension manifests for parent metadata.
 * Returns Map<extensionName, parentName|null>
 */
function scanManifestParents() {
  const parents = new Map();
  const extDir = path.join(ROOT, "apps", "back", "src", "extensions");
  if (!fs.existsSync(extDir)) return parents;

  const dirs = fs
    .readdirSync(extDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());
  for (const dir of dirs) {
    const manifestPath = path.join(
      extDir,
      dir.name,
      "extension.manifest.ts"
    );
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const content = fs.readFileSync(manifestPath, "utf-8");
      const parentMatch = content.match(/\bparent:\s*['"]([^'"]+)['"]/);
      if (parentMatch) {
        parents.set(dir.name, parentMatch[1]);
      }
    } catch {
      /* skip broken manifests */
    }
  }
  return parents;
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

function generateMermaid(modules, extensions, manifestParents) {
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
    // Fallback to manifest parent if YAML frontmatter doesn't specify one
    const manifestParent = manifestParents
      ? manifestParents.get(ext.fm.id)
      : undefined;
    const effectiveParent = ext.fm.parent || manifestParent;
    if (
      effectiveParent !== undefined &&
      effectiveParent !== null &&
      effectiveParent !== "null"
    ) {
      const parentId = escapeMermaidId(effectiveParent);
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

function extensionsTable(extensions, manifestParents) {
  const rows = [
    "| ID | Name | Parent | Dependencies |",
    "|----|------|--------|--------------|",
  ];
  for (const ext of extensions) {
    const manifestParent = manifestParents
      ? manifestParents.get(ext.fm.id)
      : undefined;
    const effectiveParent = ext.fm.parent || manifestParent;
    const parent = effectiveParent || "—";
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

// ─── Skill Frontmatter Parser (handles multi-line YAML) ─────────────────────

/**
 * Parses YAML frontmatter from SKILL.md files.
 * Handles block scalar indicators (|, >, |-, >-, etc.) for multi-line values.
 * Returns { name, description } or null if no frontmatter found.
 */
function parseSkillFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  const raw = match[1].replace(/\r\n/g, "\n");
  const result = {};
  const lines = raw.split("\n");

  let currentKey = null;
  let currentValLines = [];
  let inMultiline = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line starts a new key-value pair
    const newKeyMatch = line.match(/^(\w+):\s*(.*)$/);
    if (newKeyMatch) {
      // Save previous multiline accumulation
      if (currentKey && currentValLines.length > 0) {
        result[currentKey] = currentValLines.join(" ").trim();
      }

      currentKey = newKeyMatch[1];
      const val = newKeyMatch[2].trim();

      // Detect block scalar indicators (|, >, |-, >-, |+, >+)
      if (/^[|>][-+]?$/.test(val)) {
        inMultiline = true;
        currentValLines = [];
        continue;
      }

      // Simple scalar value
      if (val) {
        const qMatch = val.match(/^"(.*)"$/);
        result[currentKey] = qMatch ? qMatch[1] : val;
        currentKey = null;
        currentValLines = [];
        inMultiline = false;
        continue;
      }

      // Empty value → treat as multiline
      inMultiline = true;
      currentValLines = [];
      continue;
    }

    // Continuation of multiline value (indented line)
    if (inMultiline && currentKey) {
      const trimmed = line.trim();
      if (trimmed) {
        currentValLines.push(trimmed);
      }
      continue;
    }
  }

  // Save last accumulation
  if (currentKey && currentValLines.length > 0) {
    result[currentKey] = currentValLines.join(" ").trim();
  }

  return result;
}

// ─── Skill Scanning ─────────────────────────────────────────────────────────

/**
 * Scans for SKILL.md files in project, user config, and agents directories.
 * Parses YAML frontmatter, filters out _shared.
 * Project skills take precedence (dedup by name).
 * Returns sorted array of { name, description }.
 */
function scanSkills() {
  const skills = [];
  const seen = new Set();

  const searchPaths = [
    path.join(ROOT, ".agents", "skills"),
    path.join(ROOT, ".agents", "skills"),
    path.join(os.homedir(), ".config", "opencode", "skills"),
    path.join(os.homedir(), ".agents", "skills"),
  ];

  for (const skillsDir of searchPaths) {
    if (!fs.existsSync(skillsDir)) continue;

    const dirs = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of dirs) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "_shared") continue;
      if (seen.has(entry.name)) continue; // first occurrence wins

      const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;

      const content = fs.readFileSync(skillPath, "utf-8");
      const fm = parseSkillFrontmatter(content);

      if (fm && fm.name) {
        skills.push({
          name: fm.name,
          description: fm.description || entry.name,
          path: skillPath,
        });
        seen.add(fm.name);
      } else {
        // Fallback: use directory name
        skills.push({
          name: entry.name,
          description: entry.name,
          path: skillPath,
        });
        seen.add(entry.name);
      }
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

// ─── Root-level Doc Scanning ────────────────────────────────────────────────

/**
 * Scans docs/**\/*.md (excluding ARCHITECTURE.md and README.md).
 * Walks recursively through all subdirectories.
 * Parses YAML frontmatter for id, name, type.
 * Returns array of { path, id, name, type }.
 */
function scanRootDocs() {
  const docs = [];
  const docsDir = path.join(ROOT, "docs");
  if (!fs.existsSync(docsDir)) return docs;

  function walkDir(dir, baseRel) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".gitkeep") continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath, path.join(baseRel, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const relPath = path.join("docs", baseRel, entry.name)
          .replace(/\\/g, "/");

        // Skip ARCHITECTURE.md and README.md
        if (relPath === "docs/ARCHITECTURE.md") continue;
        if (entry.name.toLowerCase() === "readme.md") continue;

        const content = fs.readFileSync(fullPath, "utf-8");
        const fm = parseFrontmatter(content);

        let type = "root";
        if (baseRel.startsWith("modules")) type = "module";
        else if (baseRel.startsWith("extensions")) type = "extension";
        else if (baseRel.startsWith("custom")) type = "custom";
        else if (baseRel.startsWith("research")) type = "research";

        docs.push({
          path: relPath,
          id: fm ? fm.id || null : null,
          name: fm ? fm.name || null : null,
          type,
        });
      }
    }
  }

  walkDir(docsDir, "");
  return docs;
}

// ─── Table Generators ───────────────────────────────────────────────────────

/**
 * Generates markdown skills table from parsed SKILL.md data.
 */
function generateSkillsTable(skills) {
  const rows = [
    "| Skill | Propósito | Cuándo cargar |",
    "|-------|-----------|---------------|",
  ];
  for (const s of skills) {
    const desc = (s.description || s.name).replace(/\n/g, " ");
    rows.push(`| \`${s.name}\` | ${desc} | See description |`);
  }
  return rows.join("\n");
}

/**
 * Generates markdown docs table from scanned docs.
 * Groups: modules first, then extensions, then root-level, then custom/research.
 */
function generateDocsTable(docs) {
  const order = ["module", "extension", "root", "custom", "research"];
  const grouped = {};

  for (const doc of docs) {
    if (!grouped[doc.type]) grouped[doc.type] = [];
    grouped[doc.type].push(doc);
  }

  const rows = [
    "| Documento | Contenido |",
    "|-----------|-----------|",
  ];

  for (const type of order) {
    const group = grouped[type] || [];
    group.sort((a, b) => a.path.localeCompare(b.path));

    for (const doc of group) {
      const name = doc.name || doc.id || doc.path.split("/").pop().replace(".md", "");
      rows.push(`| \`${doc.path}\` | ${name} |`);
    }
  }

  return rows.join("\n");
}

// ─── AGENTS.md Sync ─────────────────────────────────────────────────────────

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces content between <!-- skills-start --> / <!-- skills-end -->
 * and <!-- docs-start --> / <!-- docs-end --> markers in AGENTS.md.
 * Generates tables from scanned skills and docs data.
 */
function syncAgentsMd(skills, docs) {
  const agentsPath = path.join(ROOT, "AGENTS.md");
  if (!fs.existsSync(agentsPath)) {
    console.warn("   ⚠ AGENTS.md not found, skipping sync");
    return;
  }

  let content = fs.readFileSync(agentsPath, "utf-8");

  // Replace skills section
  const skillsStart = "<!-- skills-start -->";
  const skillsEnd = "<!-- skills-end -->";
  const skillsRegex = new RegExp(
    `${escapeRegex(skillsStart)}\\s*[\\s\\S]*?\\s*${escapeRegex(skillsEnd)}`
  );

  if (skillsRegex.test(content)) {
    const skillsTable = generateSkillsTable(skills);
    content = content.replace(
      skillsRegex,
      `${skillsStart}\n\n${skillsTable}\n\n${skillsEnd}`
    );
    console.log(`   ✓ Skills table: ${skills.length} skills`);
  } else {
    console.warn("   ⚠ Skills markers not found in AGENTS.md, skipping");
  }

  // Replace docs section
  const docsStart = "<!-- docs-start -->";
  const docsEnd = "<!-- docs-end -->";
  const docsRegex = new RegExp(
    `${escapeRegex(docsStart)}\\s*[\\s\\S]*?\\s*${escapeRegex(docsEnd)}`
  );

  if (docsRegex.test(content)) {
    const docsTable = generateDocsTable(docs);
    content = content.replace(
      docsRegex,
      `${docsStart}\n\n${docsTable}\n\n${docsEnd}`
    );
    console.log(`   ✓ Docs table: ${docs.length} documents`);
  } else {
    console.warn("   ⚠ Docs markers not found in AGENTS.md, skipping");
  }

  fs.writeFileSync(agentsPath, content, "utf-8");
}

// ─── OpenCode Config Generator ──────────────────────────────────────────────

/**
 * Generates .agents/generated.json from scanned skills and docs.
 * Written as a JSON file with metadata including source and timestamp.
 */
function generateOpenCodeConfig(skills, docs) {
  const outPath = path.join(ROOT, ".agents", "generated.json");

  const skillsData = skills.map((s) => ({
    name: s.name,
    path: path.relative(ROOT, s.path).replace(/\\/g, "/"),
    description: s.description || s.name,
  }));

  const docsData = docs.map((d) => {
    const entry = { path: d.path };
    if (d.id) entry.id = d.id;
    if (d.name) entry.name = d.name;
    if (d.type) entry.type = d.type;
    return entry;
  });

  const config = {
    $schema: "https://opencode.ai/config.json",
    _generated: true,
    _timestamp: new Date().toISOString(),
    _source: "bin/sync-docs.js",
    skills: skillsData,
    docs: docsData,
  };

  fs.writeFileSync(outPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  console.log(`   ✓ OpenCode config: ${skillsData.length} skills, ${docsData.length} docs`);
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

  // Scan manifest parents once for Mermaid + extensions table
  const manifestParents = scanManifestParents();
  if (manifestParents.size > 0) {
    console.log(
      `   Found ${manifestParents.size} extension(s) with parent metadata in manifests`
    );
  }

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

${extensions.length > 0 ? extensionsTable(extensions, manifestParents) : "No extensions registered."}

---

## Custom Documentation

${customDocs.length > 0 ? customTable(customDocs) : "No custom documents registered."}

---

## Research Documents

${researchDocs.length > 0 ? researchList(researchDocs) : "None."}

---

## Dependency Diagram

\`\`\`mermaid
${generateMermaid(modules, extensions, manifestParents)}
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

  // Sync AGENTS.md with skills and docs tables
  console.log("\n📄 Syncing AGENTS.md skills and docs tables...");
  const allSkills = scanSkills();
  const allDocs = scanRootDocs();
  syncAgentsMd(allSkills, allDocs);

  // Generate .agents/generated.json
  console.log("\n📄 Generating .agents/generated.json...");
  generateOpenCodeConfig(allSkills, allDocs);

  console.log("\n✅ Done — all validations passed.");
  process.exit(0);
}

main();
