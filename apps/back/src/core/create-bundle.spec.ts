import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('create-bundle', () => {
  let repoRoot: string;
  let tmpDir: string;
  let tsxPath: string;

  beforeAll(() => {
    repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    tsxPath = path.join(repoRoot, 'node_modules', '.bin', 'tsx.cmd');
    if (!fs.existsSync(tsxPath)) {
      // Fallback for Unix
      tsxPath = path.join(repoRoot, 'node_modules', '.bin', 'tsx');
    }
  });

  beforeEach(() => {
    tmpDir = path.join(
      os.tmpdir(),
      `foundation-bundle-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    fs.mkdirSync(path.join(tmpDir, 'apps', 'back', 'src', 'extensions'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(tmpDir, 'apps', 'front', 'modules'), {
      recursive: true,
    });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function createExtension(
    dirName: string,
    manifestFields: Record<string, unknown>,
  ): void {
    const extDir = path.join(
      tmpDir,
      'apps',
      'back',
      'src',
      'extensions',
      dirName,
    );
    fs.mkdirSync(extDir, { recursive: true });

    let content = `export const manifest = {\n  name: '${dirName}'`;
    if (manifestFields.version !== undefined) {
      content += `,\n  version: '${manifestFields.version}'`;
    }
    if (manifestFields.parent !== undefined) {
      content += `,\n  parent: '${manifestFields.parent}'`;
    }
    content += '\n};\n';
    fs.writeFileSync(path.join(extDir, 'extension.manifest.ts'), content);

    // Add a dummy module file so the extension directory has real content to bundle
    fs.writeFileSync(
      path.join(extDir, 'extension.module.ts'),
      'export class DummyModule {}',
    );
  }

  function runBundle(extName: string): {
    stdout: string;
    stderr: string;
    exitCode: number;
  } {
    const scriptPath = path.join(repoRoot, 'bin', 'create-bundle.ts');

    try {
      const stdout = execSync(`"${tsxPath}" "${scriptPath}" "${extName}"`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
      });
      return { stdout, stderr: '', exitCode: 0 };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: e.stdout?.toString() ?? '',
        stderr: e.stderr?.toString() ?? '',
        exitCode: e.status ?? 1,
      };
    }
  }

  function listZipEntries(zipPath: string): string[] {
    const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
    const psCmd =
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
      `$entries = [System.IO.Compression.ZipFile]::OpenRead(${quote(zipPath)}).Entries; ` +
      `foreach ($e in $entries) { $e.FullName }`;

    const output = execSync(`powershell -Command "${psCmd}"`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    return output
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.replace(/\\/g, '/')); // Normalize Windows backslashes
  }

  it('should fail when extension not found', () => {
    const { stdout, exitCode } = runBundle('nonexistent-ext');

    expect(exitCode).toBe(1);
    expect(stdout.toLowerCase()).toContain('not found');
  });

  it('should bundle extension without children', () => {
    createExtension('stripe', { version: '1.0.0' });

    const { stdout, exitCode } = runBundle('stripe');

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Bundle created');

    const distDir = path.join(tmpDir, 'dist');
    const files = fs.readdirSync(distDir);
    const zipFile = files.find((f) => f.endsWith('.zip'));
    expect(zipFile).toBeDefined();

    const zipPath = path.join(distDir, zipFile!);
    expect(fs.statSync(zipPath).size).toBeGreaterThan(0);
  });

  it('should bundle extension with children recursively', () => {
    createExtension('a', { version: '1.0.0' });
    createExtension('b', { version: '1.0.0', parent: 'a' });
    createExtension('c', { version: '2.0.0', parent: 'b' });

    const { stdout, exitCode } = runBundle('a');

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Bundle created');

    const distDir = path.join(tmpDir, 'dist');
    const files = fs.readdirSync(distDir);
    const zipFile = files.find((f) => f.endsWith('.zip'));
    expect(zipFile).toBeDefined();

    const zipPath = path.join(distDir, zipFile!);
    const entries = listZipEntries(zipPath);

    // Each extension should have its own folder inside the zip
    const hasEntry = (name: string) =>
      entries.some((e) => e.startsWith(`${name}/`));
    expect(hasEntry('a')).toBe(true);
    expect(hasEntry('b')).toBe(true);
    expect(hasEntry('c')).toBe(true);
  });

  it('should handle circular references gracefully', () => {
    createExtension('a', { version: '1.0.0', parent: 'b' });
    createExtension('b', { version: '1.0.0', parent: 'a' });

    const { stdout, exitCode } = runBundle('a');

    // Should succeed without crashing, even with circular references
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Bundle created');
  });
});
