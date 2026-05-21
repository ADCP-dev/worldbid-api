export function useLogger(context: string) {
  const isDev = process.env.NODE_ENV === 'development'

  return {
    log: (...args: unknown[]) => isDev && console.log(`[${context}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[${context}]`, ...args),
    error: (...args: unknown[]) => console.error(`[${context}]`, ...args),
    debug: (...args: unknown[]) => isDev && console.debug(`[${context}]`, ...args),
  }
}
