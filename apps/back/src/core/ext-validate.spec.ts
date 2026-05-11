import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const TEST_PREFIX = '__test_extval_';

describe('ext-validate', () => {
  let repoRoot: string;
  let realExtDir: string;

  beforeAll(() => {
    repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    realExtDir = path.join(repoRoot, 'apps', 'back', 'src', 'extensions');
  });

  afterEach(() => {
    if (fs.existsSync(realExtDir)) {
      for (const entry of fs.readdirSync(realExtDir, { withFileTypes: true })) {
        if (entry.name.startsWith(TEST_PREFIX) && entry.isDirectory()) {
          fs.rmSync(path.join(realExtDir, entry.name), {
            recursive: true,
            force: true,
          });
        }
      }
    }
  });

  function createTestExtension(
    dirSuffix: string,
    manifestFields: Record<string, unknown>,
  ): string {
    const dirName = `${TEST_PREFIX}${dirSuffix}`;
    const extDir = path.join(realExtDir, dirName);
    fs.mkdirSync(extDir, { recursive: true });

    let content = `export const manifest = {\n  name: '${dirName}'`;
    if (manifestFields.version !== undefined) {
      content += `,\n  version: '${manifestFields.version}'`;
    }
    if (manifestFields.parent !== undefined) {
      content += `,\n  parent: '${manifestFields.parent}'`;
    }
    if (manifestFields.deps !== undefined) {
      const deps = manifestFields.deps as string[];
      content += `,\n  dependencies: {\n    extensions: ['${deps.join("', '")}']\n  }`;
    }
    content += '\n};\n';
    fs.writeFileSync(path.join(extDir, 'extension.manifest.ts'), content);
    return dirName;
  }

  function runValidate(extName?: string): {
    stdout: string;
    stderr: string;
    exitCode: number;
  } {
    const scriptPath = path.join(repoRoot, 'bin', 'ext-validate.ts');
    const cmd = extName
      ? `npx tsx "${scriptPath}" "${extName}"`
      : `npx tsx "${scriptPath}"`;

    try {
      const stdout = execSync(cmd, {
        cwd: repoRoot,
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

  it('should pass when no extensions have parent', () => {
    const nameA = createTestExtension('stripe', { version: '1.0.0' });
    const nameB = createTestExtension('blog', { version: '1.0.0' });

    const { stdout, exitCode } = runValidate();

    expect(exitCode).toBe(0);
    expect(stdout).toContain('PASSED');
    expect(stdout).toContain(nameA);
    expect(stdout).toContain(nameB);
  });

  it('should detect parent_not_found', () => {
    const name = createTestExtension('mypay', {
      version: '1.0.0',
      parent: `${TEST_PREFIX}nonexistent`,
    });

    const { stdout, exitCode } = runValidate();

    expect(exitCode).toBe(1);
    expect(stdout).toContain('FAILED');
    const output = (stdout as string).toLowerCase();
    expect(
      output.includes('parent_not_found') || output.includes('not found'),
    ).toBe(true);
  });

  it('should detect parent_not_in_deps', () => {
    const stripeName = createTestExtension('stripe', { version: '1.0.0' });
    createTestExtension('stripe-sub', {
      version: '1.0.0',
      parent: stripeName,
    });

    const { stdout, exitCode } = runValidate();

    expect(exitCode).toBe(1);
    expect(stdout).toContain('FAILED');
    expect(stdout.toLowerCase()).toContain('dependencies');
  });

  it('should detect parent_cycle', () => {
    const nameA = createTestExtension('a', {
      version: '1.0.0',
      parent: `${TEST_PREFIX}b`,
    });
    const nameB = createTestExtension('b', {
      version: '1.0.0',
      parent: `${TEST_PREFIX}a`,
    });

    const { stdout, exitCode } = runValidate();

    expect(exitCode).toBe(1);
    expect(stdout).toContain('FAILED');
    expect(stdout.toLowerCase()).toContain('cycle');
  });

  it('should pass with valid parent chain', () => {
    const stripeName = createTestExtension('stripe', { version: '1.0.0' });
    createTestExtension('stripe-sub', {
      version: '1.0.0',
      parent: stripeName,
      deps: [stripeName],
    });

    const { stdout, exitCode } = runValidate();

    expect(exitCode).toBe(0);
    expect(stdout).toContain('PASSED');
  });

  it('should validate specific extension', () => {
    const nameA = createTestExtension('stripe', { version: '1.0.0' });
    const nameB = createTestExtension('blog', { version: '1.0.0' });

    const { stdout, exitCode } = runValidate(nameA);

    expect(exitCode).toBe(0);
    expect(stdout).toContain(nameA);
    expect(stdout).not.toContain(nameB);
  });
});
