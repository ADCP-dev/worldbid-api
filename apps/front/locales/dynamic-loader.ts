export default defineI18nLocale(async (locale) => {
  // Use import.meta.glob to find and lazy-load all json files inside the locales directory
  // The structure can be `locales/[locale]/[namespace].json` or nested `locales/[locale]/dir/sub_dir/[namespace].json`
  const files = import.meta.glob('./**/*.json')

  const messages: Record<string, any> = {}

  for (const path in files) {
    // Check if the file corresponds to the requested locale
    if (path.startsWith(`./${locale}/`)) {
      // Extract the relative path without locale and extension (e.g., "base/auth" from "./es/base/auth.json")
      const prefix = `./${locale}/`
      const relativePath = path.slice(prefix.length, -5) // -5 removes '.json'

      const parts = relativePath.split('/')

      // Import the file asynchronously
      const mod = await files[path]() as { default: any }

      // Build nested object structure for i18n
      // e.g. ['base', 'settings'] -> messages.base.settings = mod.default
      let current = messages
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {}
        }
        current = current[parts[i]]
      }

      const filename = parts[parts.length - 1]
      current[filename] = mod.default
    }
  }

  return messages
})
