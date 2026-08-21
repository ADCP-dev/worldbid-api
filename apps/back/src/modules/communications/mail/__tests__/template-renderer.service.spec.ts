import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';

/**
 * T-014 — TemplateRenderer service.
 *
 * Wraps Maizzle v6 createRenderer() (lazy, dynamic import from CJS). Caches
 * render results by path + sha256(stableStringify(config)). Generates
 * plaintext via createPlaintext(html) — DEVIATION 1: the reusable renderer
 * returns `plaintext` as a config object, NOT the plaintext string.
 *
 * OnModuleDestroy closes the renderer (releases the Vite SSR server).
 *
 * Unit tests mock @maizzle/framework to avoid spinning a real Vite server.
 * Integration coverage (real renderer) lives in the spike + template specs.
 */
describe('T-014 — TemplateRenderer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should lazily create the renderer on first render and reuse it', async () => {
    const renderSpy = vi.fn().mockResolvedValue({ html: '<p>hi</p>' });
    const closeSpy = vi.fn().mockResolvedValue(undefined);
    const createRendererSpy = vi.fn().mockResolvedValue({
      render: renderSpy,
      close: closeSpy,
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    });

    vi.doMock('@maizzle/framework', () => ({
      createRenderer: createRendererSpy,
      createPlaintext: vi.fn().mockReturnValue('plain text'),
    }));

    const { TemplateRenderer } = await import(
      '@comms/mail/services/template-renderer.service'
    );
    const renderer = new TemplateRenderer();
    const templatePath = resolve(__dirname, 'fixtures/spike.vue');
    const config = { subject: 'A' };

    await renderer.render(templatePath, config);
    await renderer.render(templatePath, { subject: 'B' });

    // createRenderer called exactly once (lazy, reused).
    expect(createRendererSpy).toHaveBeenCalledTimes(1);
    // renderer.render called twice (different config = cache miss).
    expect(renderSpy).toHaveBeenCalledTimes(2);
    await renderer.onModuleDestroy();
  });

  it('should return cached result on cache hit (same path + config)', async () => {
    const renderSpy = vi.fn().mockResolvedValue({ html: '<p>hi</p>' });
    const createRendererSpy = vi.fn().mockResolvedValue({
      render: renderSpy,
      close: vi.fn(),
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    });

    vi.doMock('@maizzle/framework', () => ({
      createRenderer: createRendererSpy,
      createPlaintext: vi.fn().mockReturnValue('plain'),
    }));

    const { TemplateRenderer } = await import(
      '@comms/mail/services/template-renderer.service'
    );
    const renderer = new TemplateRenderer();
    const templatePath = resolve(__dirname, 'fixtures/spike.vue');
    const config = { subject: 'A', link: 'https://x.test' };

    const first = await renderer.render(templatePath, config);
    const second = await renderer.render(templatePath, config);

    // Cache hit: renderer.render called only once.
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(second.html).toBe(first.html);
    expect(second.plaintext).toBe(first.plaintext);
    await renderer.onModuleDestroy();
  });

  it('should treat configs with same keys in different order as same cache key', async () => {
    const renderSpy = vi.fn().mockResolvedValue({ html: '<p>hi</p>' });
    const createRendererSpy = vi.fn().mockResolvedValue({
      render: renderSpy,
      close: vi.fn(),
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    });

    vi.doMock('@maizzle/framework', () => ({
      createRenderer: createRendererSpy,
      createPlaintext: vi.fn().mockReturnValue('plain'),
    }));

    const { TemplateRenderer } = await import(
      '@comms/mail/services/template-renderer.service'
    );
    const renderer = new TemplateRenderer();
    const templatePath = resolve(__dirname, 'fixtures/spike.vue');

    await renderer.render(templatePath, { a: 1, b: 2 });
    await renderer.render(templatePath, { b: 2, a: 1 });

    // Stable serialization → same cache key → single render call.
    expect(renderSpy).toHaveBeenCalledTimes(1);
    await renderer.onModuleDestroy();
  });

  it('should generate plaintext via createPlaintext(html), not from result.plaintext', async () => {
    const renderSpy = vi.fn().mockResolvedValue({
      html: '<p>Hello Alex</p>',
      plaintext: {}, // DEVIATION 1: config object, NOT the string
    });
    const createPlaintextSpy = vi.fn().mockReturnValue('Hello Alex');
    const createRendererSpy = vi.fn().mockResolvedValue({
      render: renderSpy,
      close: vi.fn(),
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    });

    vi.doMock('@maizzle/framework', () => ({
      createRenderer: createRendererSpy,
      createPlaintext: createPlaintextSpy,
    }));

    const { TemplateRenderer } = await import(
      '@comms/mail/services/template-renderer.service'
    );
    const renderer = new TemplateRenderer();
    const result = await renderer.render('/fake/path.vue', { subject: 'A' });

    // createPlaintext called with the html (DEVIATION 1).
    expect(createPlaintextSpy).toHaveBeenCalledWith('<p>Hello Alex</p>');
    // The returned plaintext is the string from createPlaintext, NOT the
    // config object from result.plaintext.
    expect(result.plaintext).toBe('Hello Alex');
    expect(typeof result.plaintext).toBe('string');
    await renderer.onModuleDestroy();
  });

  it('should log and re-throw render errors without caching partial results', async () => {
    const renderSpy = vi.fn().mockRejectedValue(new Error('Vue compile error'));
    const createRendererSpy = vi.fn().mockResolvedValue({
      render: renderSpy,
      close: vi.fn(),
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    });

    vi.doMock('@maizzle/framework', () => ({
      createRenderer: createRendererSpy,
      createPlaintext: vi.fn().mockReturnValue('plain'),
    }));

    const { TemplateRenderer } = await import(
      '@comms/mail/services/template-renderer.service'
    );
    const renderer = new TemplateRenderer();
    const templatePath = '/bad/template.vue';
    const config = { subject: 'A' };

    await expect(renderer.render(templatePath, config)).rejects.toThrow(
      'Vue compile error',
    );

    // Second call with same args should NOT be cached (error not cached).
    await expect(renderer.render(templatePath, config)).rejects.toThrow(
      'Vue compile error',
    );
    // renderer.render called twice (no cache on error).
    expect(renderSpy).toHaveBeenCalledTimes(2);
    await renderer.onModuleDestroy();
  });

  it('should close the renderer on OnModuleDestroy', async () => {
    const closeSpy = vi.fn().mockResolvedValue(undefined);
    const createRendererSpy = vi.fn().mockResolvedValue({
      render: vi.fn().mockResolvedValue({ html: '<p>hi</p>' }),
      close: closeSpy,
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    });

    vi.doMock('@maizzle/framework', () => ({
      createRenderer: createRendererSpy,
      createPlaintext: vi.fn().mockReturnValue('plain'),
    }));

    const { TemplateRenderer } = await import(
      '@comms/mail/services/template-renderer.service'
    );
    const renderer = new TemplateRenderer();
    await renderer.render('/fake.vue', { subject: 'A' });
    await renderer.onModuleDestroy();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('should clear the cache via clearCache()', async () => {
    const renderSpy = vi.fn().mockResolvedValue({ html: '<p>hi</p>' });
    const createRendererSpy = vi.fn().mockResolvedValue({
      render: renderSpy,
      close: vi.fn(),
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    });

    vi.doMock('@maizzle/framework', () => ({
      createRenderer: createRendererSpy,
      createPlaintext: vi.fn().mockReturnValue('plain'),
    }));

    const { TemplateRenderer } = await import(
      '@comms/mail/services/template-renderer.service'
    );
    const renderer = new TemplateRenderer();
    const templatePath = '/fake.vue';
    const config = { subject: 'A' };

    await renderer.render(templatePath, config);
    renderer.clearCache();
    await renderer.render(templatePath, config);

    // Cache cleared → render called twice.
    expect(renderSpy).toHaveBeenCalledTimes(2);
    await renderer.onModuleDestroy();
  });
});