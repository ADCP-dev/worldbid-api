#!/usr/bin/env node
/**
 * i18n-audit.ts — Audit i18n translations in Foundation.
 *
 * Reads JSON files from apps/front/i18n/locales/{lang}/ directly.
 * No DB, no app running needed.
 *
 * Usage:
 *   node i18n-audit.ts                          # full audit
 *   node i18n-audit.ts --key "mod.common.actions.save"  # search key
 *   node i18n-audit.ts --section "mod.common"   # list section keys
 *   node i18n-audit.ts --missing                # find missing across langs
 *   node i18n-audit.ts --unused                 # find unused keys (heuristic)
 *   node i18n-audit.ts --json                   # JSON output
 *   node i18n-audit.ts --verbose                # full details
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const verbose = args.includes('--verbose') || args.includes('-v');
const keyArg = (args.find((a) => a.startsWith('--key=')) || '').replace('--key=', '');
const sectionArg = (args.find((a) => a.startsWith('--section=')) || '').replace('--section=', '');
const onlyMissing = args.includes('--missing');
const onlyUnused = args.includes('--unused');
const checkCode = args.includes('--check-code');
const fixMissing = args.includes('--fix');

const repoRoot = path.resolve(__dirname, '../../../..');
const localesDir = path.join(repoRoot, 'apps/front/i18n/locales');
const frontSrcDir = path.join(repoRoot, 'apps/front');

if (!fs.existsSync(localesDir)) {
  console.error(`Locales directory not found: ${localesDir}`);
  process.exit(2);
}

// ─── 1. Load all languages ───────────────────────────────────────────────

const langs = fs
  .readdirSync(localesDir)
  .filter((d) => fs.statSync(path.join(localesDir, d)).isDirectory())
  .sort();

if (langs.length === 0) {
  console.error('No language directories found in', localesDir);
  process.exit(2);
}

// Flatten nested JSON into dot-path keys: { "mod": { "common": { "save": "Save" } } }
// → "mod.common.save": "Save"
function flattenJson(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenJson(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

// Load all JSON files for a language into a flat map
function loadLang(lang) {
  const langDir = path.join(localesDir, lang);
  const allKeys = {};

  function scanDir(dir, relPath = '') {
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath, relPath ? `${relPath}/${entry}` : entry);
      } else if (entry.endsWith('.json')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const json = JSON.parse(content);
          Object.assign(allKeys, flattenJson(json));
        } catch (err) {
          // skip unparseable
        }
      }
    }
  }

  scanDir(langDir);
  return allKeys;
}

const langData = {};
for (const lang of langs) {
  langData[lang] = loadLang(lang);
}

// ─── 2. Compute stats ───────────────────────────────────────────────────

const allKeysSet = new Set();
for (const lang of langs) {
  for (const key of Object.keys(langData[lang])) {
    allKeysSet.add(key);
  }
}
const allKeys = [...allKeysSet].sort();

const stats = {};
for (const lang of langs) {
  const keys = Object.keys(langData[lang]);
  stats[lang] = {
    totalKeys: keys.length,
    missing: [],
    empty: [],
  };
}

// Find missing keys (in one lang but not another)
const missingMap = {};
for (const key of allKeys) {
  for (const lang of langs) {
    if (!(key in langData[lang])) {
      stats[lang].missing.push(key);
      if (!missingMap[key]) missingMap[key] = [];
      missingMap[key].push(lang);
    } else if (
      langData[lang][key] === '' ||
      langData[lang][key] === null ||
      langData[lang][key] === undefined
    ) {
      stats[lang].empty.push(key);
    }
  }
}

// ─── 3. Find unused keys (heuristic) ─────────────────────────────────────

function findUnusedKeys() {
  const unused = [];

  // Collect ALL source code from .vue, .ts, .tsx files in the frontend.
  // Search patterns: $t('key'), $t("key"), t('key'), t("key"),
  // i18n.t('key'), $i18n.t('key'), useI18n
  let allCode = '';
  try {
    allCode = execSync(
      `find "${frontSrcDir}" -type f \\( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \\) ` +
        `-not -path "*/node_modules/*" -not -path "*/.nuxt/*" -not -path "*/.output/*" ` +
        `| head -500 | xargs cat 2>/dev/null`,
      { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 },
    );
  } catch {
    // cat might fail on binary files
  }

  // Also scan the Astro web app if it exists
  const webDir = path.join(repoRoot, 'apps/web');
  if (fs.existsSync(webDir)) {
    try {
      const webCode = execSync(
        `find "${webDir}" -type f \\( -name "*.astro" -o -name "*.ts" -o -name "*.tsx" \\) ` +
          `-not -path "*/node_modules/*" -not -path "*/dist/*" ` +
          `| head -200 | xargs cat 2>/dev/null`,
        { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 },
      );
      allCode += '\n' + webCode;
    } catch {
      // skip
    }
  }

  // Build a set of keys referenced in code
  const usedKeys = new Set();

  // Pattern 1: $t('key') or $t("key")
  const tRegex = /\$t\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  let m;
  while ((m = tRegex.exec(allCode)) !== null) {
    usedKeys.add(m[1]);
  }

  // Pattern 2: t('key') or t("key") — from useI18n() destructure
  const t2Regex = /(?<![\w$])t\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((m = t2Regex.exec(allCode)) !== null) {
    usedKeys.add(m[1]);
  }

  // Pattern 3: i18n.t('key') or $i18n.t('key')
  const i18nRegex = /\$?i18n\.t\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((m = i18nRegex.exec(allCode)) !== null) {
    usedKeys.add(m[1]);
  }

  // Pattern 4: Any literal string that matches a full key
  for (const key of allKeys) {
    if (allCode.includes(`'${key}'`) || allCode.includes(`"${key}"`)) {
      usedKeys.add(key);
    }
  }

  // Check each key: if not directly used, check if a child key is used
  // (parent keys like "mod.common.actions" are used via their children)
  for (const key of allKeys) {
    if (usedKeys.has(key)) continue;

    // Check if any child key is used (parent is implicitly used)
    const prefix = key + '.';
    for (const usedKey of usedKeys) {
      if (usedKey.startsWith(prefix)) {
        // Parent key is used via child
        // But we don't add it to usedKeys — parent without its own value
        // is still "unused" as a standalone key
        break;
      }
    }

    unused.push(key);
  }

  return unused.sort();
}

// ─── 3b. Check code keys exist in JSON ───────────────────────────────────

function findCodeKeysNotInJson() {
  // Collect all $t('key'), t('key'), $i18n.t('key') calls from code
  let allCode = '';
  try {
    allCode = execSync(
      `find "${frontSrcDir}" -type f \\( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \\) ` +
        `-not -path "*/node_modules/*" -not -path "*/.nuxt/*" -not -path "*/.output/*" ` +
        `| head -500 | xargs cat 2>/dev/null`,
      { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 },
    );
  } catch {}

  const webDir = path.join(repoRoot, 'apps/web');
  if (fs.existsSync(webDir)) {
    try {
      const webCode = execSync(
        `find "${webDir}" -type f \\( -name "*.astro" -o -name "*.ts" -o -name "*.tsx" \\) ` +
          `-not -path "*/node_modules/*" -not -path "*/dist/*" ` +
          `| head -200 | xargs cat 2>/dev/null`,
        { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 },
      );
      allCode += '\n' + webCode;
    } catch {}
  }

  const codeKeys = new Set();
  let m;

  // $t('key') or $t("key")
  const tRegex = /\$t\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((m = tRegex.exec(allCode)) !== null) codeKeys.add(m[1]);

  // t('key') standalone (from useI18n)
  const t2Regex = /(?<![\w$])t\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((m = t2Regex.exec(allCode)) !== null) codeKeys.add(m[1]);

  // $i18n.t('key')
  const i18nRegex = /\$?i18n\.t\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((m = i18nRegex.exec(allCode)) !== null) codeKeys.add(m[1]);

  // Check which code keys are NOT in JSON
  const missingFromJson = [];
  const enKeys = new Set(Object.keys(langData[langs[0]] || {}));

  for (const key of codeKeys) {
    // Skip dynamic keys (containing ${ or +)
    if (key.includes('${') || key.includes('${') || key.includes(' + ')) continue;
    if (!enKeys.has(key)) {
      missingFromJson.push(key);
    }
  }

  return missingFromJson.sort();
}

// ─── 4. Output ───────────────────────────────────────────────────────────

if (checkCode) {
  const missingFromJson = findCodeKeysNotInJson();
  console.log(`\n🔍 Code keys not found in JSON\n`);
  if (missingFromJson.length === 0) {
    console.log('  ✅ All $t() keys in code exist in JSON files.');
  } else {
    console.log(`  ${missingFromJson.length} keys used in code but missing from JSON:\n`);
    for (const key of missingFromJson) {
      console.log(`  ❌ ${key}`);
    }
  }
  process.exit(0);
}

if (asJson) {
  const output = {
    langs,
    totalKeys: allKeys.length,
    stats: {},
    missing: missingMap,
  };
  for (const lang of langs) {
    output.stats[lang] = {
      total: stats[lang].totalKeys,
      missing: stats[lang].missing.length,
      empty: stats[lang].empty.length,
      coverage: Math.round(
        ((stats[lang].totalKeys - stats[lang].missing.length) /
          Math.max(allKeys.length, 1)) *
          100,
      ),
    };
  }
  if (onlyUnused) {
    output.unused = findUnusedKeys();
  }
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

// ─── Search by key ──────────────────────────────────────────────────────

if (keyArg) {
  console.log(`\n🔑 Key: "${keyArg}"\n`);
  let found = false;
  for (const lang of langs) {
    const value = langData[lang][keyArg];
    if (value !== undefined) {
      console.log(`  ✅ ${lang}: ${JSON.stringify(value)}`);
      found = true;
    } else {
      console.log(`  ❌ ${lang}: MISSING`);
    }
  }
  if (!found) {
    console.log(`\n  Key not found in any language.`);
  }
  process.exit(0);
}

// ─── List section ────────────────────────────────────────────────────────

if (sectionArg) {
  console.log(`\n📂 Section: "${sectionArg}"\n`);
  const sectionKeys = allKeys.filter((k) => k.startsWith(sectionArg + '.'));
  if (sectionKeys.length === 0) {
    console.log('  No keys found in this section.');
    process.exit(0);
  }
  for (const key of sectionKeys) {
    const values = langs.map((l) => {
      const v = langData[l][key];
      return v !== undefined ? JSON.stringify(v).substring(0, 40) : '❌';
    });
    console.log(`  ${key}:`);
    for (let i = 0; i < langs.length; i++) {
      console.log(`    ${langs[i].padEnd(4)}: ${values[i]}`);
    }
  }
  process.exit(0);
}

// ─── Missing only ────────────────────────────────────────────────────────

if (onlyMissing) {
  console.log(`\n🔍 Missing translations\n`);
  let hasMissing = false;
  for (const [key, missingLangs] of Object.entries(missingMap)) {
    if (missingLangs.length > 0) {
      hasMissing = true;
      const presentIn = langs.filter((l) => !missingLangs.includes(l));
      console.log(`  ${key}`);
      console.log(`    Present in: ${presentIn.join(', ') || 'none'}`);
      console.log(`    Missing in: ${missingLangs.join(', ')}`);
    }
  }
  if (!hasMissing) {
    console.log('  ✅ No missing translations. All languages have all keys.');
  }
  process.exit(0);
}

// ─── Unused only ─────────────────────────────────────────────────────────

if (onlyUnused) {
  console.log(`\n🧹 Unused translation keys (heuristic)\n`);
  const unused = findUnusedKeys();
  if (unused.length === 0) {
    console.log('  ✅ No unused keys found.');
  } else {
    console.log(`  ${unused.length} potentially unused keys:\n`);
    for (const key of unused) {
      console.log(`  ${key}`);
    }
    console.log(`\n  ⚠️  This is heuristic. Dynamic keys like $t('mod.' + var)`);
    console.log(`     may show as false positives. Verify manually.`);
  }
  process.exit(0);
}

// ─── Full audit ──────────────────────────────────────────────────────────

console.log(`\n🌐 i18n Audit — ${langs.length} languages, ${allKeys.length} total keys\n`);
console.log('─'.repeat(60));

for (const lang of langs) {
  const coverage = Math.round(
    ((stats[lang].totalKeys - stats[lang].missing.length) /
      Math.max(allKeys.length, 1)) *
      100,
  );
  const bar = '█'.repeat(Math.floor(coverage / 5)) + '░'.repeat(20 - Math.floor(coverage / 5));
  console.log(`\n  ${lang}: ${bar} ${coverage}%`);
  console.log(`    Total keys: ${stats[lang].totalKeys}`);
  console.log(`    Missing:    ${stats[lang].missing.length}`);
  console.log(`    Empty:      ${stats[lang].empty.length}`);
}

console.log('\n' + '─'.repeat(60));

// Missing summary
const totalMissing = Object.values(missingMap).filter((m) => m.length > 0).length;
if (totalMissing > 0) {
  console.log(`\n⚠️  ${totalMissing} keys with missing translations:\n`);
  for (const [key, missingLangs] of Object.entries(missingMap)) {
    if (missingLangs.length > 0) {
      console.log(`  ${key} → missing in: ${missingLangs.join(', ')}`);
    }
  }
} else {
  console.log(`\n✅ All translations complete — no missing keys.`);
}

if (verbose) {
  console.log('\n' + '─'.repeat(60));
  console.log('\nAll keys:');
  for (const key of allKeys) {
    const values = langs.map((l) => {
      const v = langData[l][key];
      if (v === undefined) return '❌';
      const s = JSON.stringify(v);
      return s.length > 30 ? s.substring(0, 30) + '...' : s;
    });
    console.log(`  ${key}: ${values.join(' | ')}`);
  }
}

console.log('');