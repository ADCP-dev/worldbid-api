import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('ext-tree', () => {
  let repoRoot: string;
  let tmpDir: string;
  let tsxPath: string;

  beforeAll(() => {
    repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    tsxPath = path.join(repoRoot, 'node_modules', '.bin', 'tsx.cmd');
    if (!fs.existsSync(tsxPath)) {
      tsxPath = path.join(repoRoot, 'node_modules', '.bin', 'tsx');
    }
  });

  beforeEach(() => {
    tmpDir = path.join(
      os.tmpdir(),
      `foundation-tree-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
  }

  function runTree(): {
    stdout: string;
    stderr: string;
    exitCode: number;
  } {
    const scriptPath = path.join(repoRoot, 'bin', 'ext-tree.ts');

    try {
      const stdout = execSync(`"${tsxPath}" "${scriptPath}"`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 15000,
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

  it('should show no extensions installed when empty', () => {
    const { stdout, exitCode } = runTree();

    expect(exitCode).toBe(0);
    expect(stdout).toContain('No extensions installed');
  });

  it('should list extensions as orphans when no parent', () => {
    createExtension('stripe', { version: '1.0.0' });
    createExtension('blog', { version: '2.0.0' });

    const { stdout, exitCode } = runTree();

    expect(exitCode).toBe(0);
    expect(stdout).toContain('stripe');
    expect(stdout).toContain('blog');
    expect(stdout).toContain('orphan');
  });

  it('should show parent-child hierarchy', () => {
    createExtension('stripe', { version: '1.0.0' });
    createExtension('stripe-sub', {
      version: '1.0.0',
      parent: 'stripe',
    });

    const { stdout, exitCode } = runTree();

    expect(exitCode).toBe(0);
    expect(stdout).toContain('stripe');
    expect(stdout).toContain('stripe-sub');
    expect(stdout).toContain('[parent: stripe]');
  });

  it('should show circular reference warning', () => {
    createExtension('a', { version: '1.0.0', parent: 'b' });
    createExtension('b', { version: '1.0.0', parent: 'a' });

    const { stdout, exitCode } = runTree();

    expect(exitCode).toBe(0);
    expect(stdout.toLowerCase()).toContain('circular');
  });

  it('should show missing parent warning', () => {
    createExtension('mypay', {
      version: '1.0.0',
      parent: 'nonexistent',
    });

    const { stdout, exitCode } = runTree();

    expect(exitCode).toBe(0);
    expect(stdout).toContain('mypay');
    expect(stdout.toLowerCase()).toContain('parent not found');
  });
});
