export default defineI18nLocale(async (locale) => {
  // Use import.meta.glob to find and lazy-load all json files inside the i18n/locales directory
  // The structure can be `i18n/locales/[locale]/[namespace].json` or nested `i18n/locales/[locale]/dir/sub_dir/[namespace].json`
  const files = import.meta.glob('./**/*.json');

  const messages: Record<string, Record<string, unknown>> = {};

  for (const path in files) {
    // Check if the file corresponds to the requested locale
    if (path.startsWith(`./${locale}/`)) {
      // Extract the relative path without locale and extension (e.g., "base/auth" from "./es/base/auth.json")
      const prefix = `./${locale}/`;
      const relativePath = path.slice(prefix.length, -5); // -5 removes '.json'

      const parts = relativePath.split('/');

      // Import the file asynchronously
      const loader = files[path];
      if (!loader) continue;
      const mod = (await loader()) as { default: unknown };

      // Build nested object structure for i18n
      // e.g. ['base', 'settings'] -> messages.base.settings = mod.default
      let current: Record<string, unknown> = messages;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!part) continue;
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }

      const filename = parts[parts.length - 1];
      if (filename) {
        current[filename] = mod;
      }
    }
  }

  return messages;
});
