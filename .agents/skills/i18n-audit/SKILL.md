---
name: i18n-audit
description: >
  Audit i18n translations in Foundation without running the app. Use this
  skill when checking translation completeness, finding missing keys,
  finding unused keys, or verifying a key exists across all active languages.
  Reads JSON files directly from apps/front/i18n/locales/{lang}/. Compares
  languages, finds gaps, reports coverage. Works with 2+ languages.
---

# i18n Audit — Translation Inspector

## When to Activate

Activate when:
- Checking if a translation key exists across all languages
- Finding missing translations (keys present in one language but not another)
- Finding unused translation keys (keys in JSON files but not referenced in code)
- Auditing translation coverage (percentage complete per language)
- Listing all keys for a specific section
- Searching translations by key or value

Do NOT activate when:
- Adding a new translation (use `pnpm i18n:add` CLI)
- Syncing JSON to DB (use `pnpm translation:sync`)
- Working on non-i18n tasks

## How translations work in Foundation

Translations live in JSON files:
```
apps/front/i18n/locales/
├── en/
│   ├── mod/
│   │   ├── common.json      # { "mod": { "common": { "actions": { "save": "Save" } } } }
│   │   ├── users.json
│   │   ├── nav.json
│   │   └── ...
│   └── ext/
│       ├── cms.json
│       └── ...
└── es/
    └── (same structure)
```

Each JSON is nested: `mod/section.json` → `{ "mod": { "section": { ...keys... } } }`.

The DB has tables `lang` (active languages) and `translation` (key → content per lang).
CLI `pnpm translation:sync` syncs JSON → DB → JSON (bidirectional).

## Commands

### Audit all translations

```bash
bash .agents/skills/i18n-audit/scripts/audit.sh
```

Shows: total keys per language, missing keys, coverage %, unused keys estimate.

### Search a specific key

```bash
bash .agents/skills/i18n-audit/scripts/audit.sh --key "mod.common.actions.save"
```

Shows: value in each language, which languages are missing it.

### List keys for a section

```bash
bash .agents/skills/i18n-audit/scripts/audit.sh --section "mod.common"
```

Shows: all keys in that section across all languages.

### Find missing translations

```bash
bash .agents/skills/i18n-audit/scripts/audit.sh --missing
```

Shows: keys that exist in one language but not in another.

### Find unused keys (heuristic)

```bash
bash .agents/skills/i18n-audit/scripts/audit.sh --unused
```

Shows: keys in JSON files that are NOT referenced in any .vue or .ts file.
Note: dynamic keys (like `$t('mod.' + variable)`) may show as false positives.

### JSON output (for agents)

```bash
bash .agents/skills/i18n-audit/scripts/audit.sh --json
```