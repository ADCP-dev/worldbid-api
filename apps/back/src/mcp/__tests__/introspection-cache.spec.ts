import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IntrospectionCache } from '../introspection-cache';

describe('IntrospectionCache', () => {
  let cache: IntrospectionCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new IntrospectionCache(1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return undefined for missing key', () => {
    expect(cache.get('nope')).toBeUndefined();
  });

  it('should store and return a value within TTL', () => {
    cache.set('k', { a: 1 });
    expect(cache.get('k')).toEqual({ a: 1 });
  });

  it('should expire after TTL', () => {
    cache.set('k', 42, 1000);
    vi.advanceTimersByTime(999);
    expect(cache.get('k')).toBe(42);
    vi.advanceTimersByTime(2);
    expect(cache.get('k')).toBeUndefined();
  });

  it('should use default TTL when not specified', () => {
    cache.set('k', 'v');
    vi.advanceTimersByTime(999);
    expect(cache.get('k')).toBe('v');
    vi.advanceTimersByTime(2);
    expect(cache.get('k')).toBeUndefined();
  });

  it('should clear all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size()).toBe(2);
    cache.clearAll();
    expect(cache.size()).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('should support generic types', () => {
    const c = new IntrospectionCache();
    c.set<{ name: string }>('x', { name: 'test' });
    const v = c.get<{ name: string }>('x');
    expect(v?.name).toBe('test');
  });
});