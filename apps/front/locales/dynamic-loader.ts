export default defineI18nLocale(async (locale) => {
  // Use import.meta.glob to find and lazy-load all json files inside the locales directory
  // The structure is expected to be `locales/[locale]/[namespace].json`
  const files = import.meta.glob('./*/*.json')

  const messages: Record<string, any> = {}

  for (const path in files) {
    // Check if the file corresponds to the requested locale
    if (path.startsWith(`./${locale}/`)) {
      // Extract the namespace from the filename (e.g., "landing" from "./es/landing.json")
      const namespaceMatch = path.match(/\.\/[^/]+\/(.+)\.json/)
      if (namespaceMatch) {
        const namespace = namespaceMatch[1]

        // Import the file asynchronously and assign it to the namespace root
        const mod = await files[path]() as { default: any }
        messages[namespace] = mod.default
      }
    }
  }

  return messages
})
