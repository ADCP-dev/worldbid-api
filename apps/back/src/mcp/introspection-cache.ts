/**
 * IntrospectionCache — in-memory TTL cache for introspector results.
 *
 * Each introspector wraps its reads with cache.get/set keyed by method+args.
 * The SpecLoader EventEmitter clears all entries on reload.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class IntrospectionCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = DEFAULT_TTL_MS) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  clearAll(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}