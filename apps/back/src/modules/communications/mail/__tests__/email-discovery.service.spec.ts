import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * T-016 — EmailDiscoveryService.
 *
 * Scans three roots for .vue email templates and returns a Map of name to
 * path. Roots (D-02): extensions emails, modules emails, and packages
 * emails. No templates subfolder required. Extension-level paths take
 * precedence over packages-level (most specific wins). Duplicate names log
 * a warning.
 *
 * Patterns are relative to the backend cwd (apps/back/):
 *   src/extensions/*/emails/*.vue
 *   src/modules/**/emails/*.vue
 *   ../../packages/emails/emails/*.vue
 *
 * Tests simulate the backend cwd by chdir-ing into a tmp dir and creating
 * the structure relative to that cwd.
 */
describe('T-016 — EmailDiscoveryService', () => {
  let tmpRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'email-discovery-'));
    originalCwd = process.cwd();
    process.chdir(tmpRoot);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('should discover .vue templates across all three roots', async () => {
    // Create the three root structures relative to the backend cwd.
    // Extension and module patterns are relative to cwd.
    // Packages pattern uses ../../packages/ relative to cwd.
    mkdirSync(join(tmpRoot, 'src/extensions/tasks/emails'), {
      recursive: true,
    });
    mkdirSync(join(tmpRoot, 'src/modules/communications/mail/emails'), {
      recursive: true,
    });
    mkdirSync(join(tmpRoot, '../../packages/emails/emails'), {
      recursive: true,
    });

    writeFileSync(
      join(tmpRoot, 'src/extensions/tasks/emails/task-assigned.vue'),
      '<template>task</template>',
    );
    writeFileSync(
      join(tmpRoot, 'src/modules/communications/mail/emails/contact.vue'),
      '<template>contact</template>',
    );
    writeFileSync(
      join(tmpRoot, '../../packages/emails/emails/activation.vue'),
      '<template>activation</template>',
    );

    vi.resetModules();
    const { EmailDiscoveryService } = await import(
      '@comms/mail/services/email-discovery.service'
    );
    const service = new EmailDiscoveryService();
    const found = await service.findAll();

    expect(found.size).toBe(3);
    expect(found.has('task-assigned')).toBe(true);
    expect(found.has('contact')).toBe(true);
    expect(found.has('activation')).toBe(true);

    const activationPath = found.get('activation')!;
    expect(activationPath).toContain('packages/emails/emails/activation.vue');
  });

  it('should give extension-level precedence over packages-level on name collision', async () => {
    mkdirSync(join(tmpRoot, 'src/extensions/foo/emails'), {
      recursive: true,
    });
    mkdirSync(join(tmpRoot, '../../packages/emails/emails'), {
      recursive: true,
    });

    writeFileSync(
      join(tmpRoot, 'src/extensions/foo/emails/reset-password.vue'),
      '<template>ext</template>',
    );
    writeFileSync(
      join(tmpRoot, '../../packages/emails/emails/reset-password.vue'),
      '<template>pkg</template>',
    );

    vi.resetModules();
    const { EmailDiscoveryService } = await import(
      '@comms/mail/services/email-discovery.service'
    );
    const service = new EmailDiscoveryService();
    const found = await service.findAll();

    // Only one entry (extension-level wins).
    expect(found.size).toBe(1);
    const path = found.get('reset-password')!;
    expect(path).toContain('extensions/foo/emails/reset-password.vue');
  });

  it('should resolve a template by name via resolveByName()', async () => {
    mkdirSync(join(tmpRoot, '../../packages/emails/emails'), {
      recursive: true,
    });
    writeFileSync(
      join(tmpRoot, '../../packages/emails/emails/activation.vue'),
      '<template>a</template>',
    );

    vi.resetModules();
    const { EmailDiscoveryService } = await import(
      '@comms/mail/services/email-discovery.service'
    );
    const service = new EmailDiscoveryService();

    const path = await service.resolveByName('activation');
    expect(path).not.toBeNull();
    expect(path).toContain('activation.vue');
  });

  it('should return null for unknown template name', async () => {
    mkdirSync(join(tmpRoot, '../../packages/emails/emails'), {
      recursive: true,
    });

    vi.resetModules();
    const { EmailDiscoveryService } = await import(
      '@comms/mail/services/email-discovery.service'
    );
    const service = new EmailDiscoveryService();

    const path = await service.resolveByName('nonexistent');
    expect(path).toBeNull();
  });

  it('should cache results and re-scan on force=true', async () => {
    mkdirSync(join(tmpRoot, '../../packages/emails/emails'), {
      recursive: true,
    });
    writeFileSync(
      join(tmpRoot, '../../packages/emails/emails/activation.vue'),
      '<template>a</template>',
    );

    vi.resetModules();
    const { EmailDiscoveryService } = await import(
      '@comms/mail/services/email-discovery.service'
    );
    const service = new EmailDiscoveryService();

    const first = await service.findAll();
    expect(first.size).toBe(1);

    // Add a new template after the first scan.
    writeFileSync(
      join(tmpRoot, '../../packages/emails/emails/reset-password.vue'),
      '<template>r</template>',
    );

    // Cached — still 1.
    const cached = await service.findAll();
    expect(cached.size).toBe(1);

    // Force re-scan — now 2.
    const forced = await service.findAll(true);
    expect(forced.size).toBe(2);
  });

  it('should clear cache via clear()', async () => {
    mkdirSync(join(tmpRoot, '../../packages/emails/emails'), {
      recursive: true,
    });
    writeFileSync(
      join(tmpRoot, '../../packages/emails/emails/activation.vue'),
      '<template>a</template>',
    );

    vi.resetModules();
    const { EmailDiscoveryService } = await import(
      '@comms/mail/services/email-discovery.service'
    );
    const service = new EmailDiscoveryService();

    await service.findAll();
    service.clear();

    // After clear, next findAll re-scans.
    writeFileSync(
      join(tmpRoot, '../../packages/emails/emails/reset-password.vue'),
      '<template>r</template>',
    );
    const reloaded = await service.findAll();
    expect(reloaded.size).toBe(2);
  });
});