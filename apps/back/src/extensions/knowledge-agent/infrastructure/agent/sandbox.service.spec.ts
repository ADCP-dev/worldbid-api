import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { tmpdir } from 'node:os';
import { SandboxService } from './sandbox.service';

describe('SandboxService', () => {
  let service: SandboxService;
  let createVfs: jest.Mock;
  let quickJsEval: jest.Mock;

  beforeEach(async () => {
    createVfs = jest.fn().mockResolvedValue({ stop: jest.fn() });
    quickJsEval = jest.fn().mockResolvedValue('4');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SandboxService,
        { provide: ConfigService, useValue: { get: () => null } },
      ],
    }).compile();
    service = module.get<SandboxService>(SandboxService);
    service['logger'] = new Logger() as unknown as Logger;
    service['createVfsBackend'] = createVfs;
    service['quickJsEval'] = quickJsEval;
  });

  afterEach(() => jest.clearAllMocks());

  describe('createSandbox', () => {
    it('should create a VfsBackend with an isolated working dir', async () => {
      await service.createSandbox('session-1');

      expect(createVfs).toHaveBeenCalledTimes(1);
      const opts = createVfs.mock.calls[0][0];
      expect(opts.mountPath).toContain('ka-sandbox');
      // Working dir is hashed from sessionId for a stable, unique path.
      expect(opts.mountPath).not.toBe(tmpdir());
    });

    it('should deny .env and credentials in permissions (ABSOLUTE paths — deepagents requires them)', () => {
      const perms = service.buildPermissions();
      const cwd = process.cwd();

      const denied = perms.filter((p) => p.mode === 'deny');
      const deniedPaths = denied.flatMap((p) => p.paths);
      expect(deniedPaths).toEqual(
        expect.arrayContaining([
          `${cwd}/.env`,
          `${cwd}/**/.env`,
          `${cwd}/**/credentials`,
          `${cwd}/**/*.key`,
        ]),
      );
      // Every deny path must be absolute — deepagents validatePath rejects
      // relative paths with "path must be absolute".
      for (const p of deniedPaths) {
        expect(p.startsWith('/')).toBe(true);
      }
    });

    it('should deny project source paths (apps/, packages/)', () => {
      const cwd = process.cwd();
      const perms = service.buildPermissions();

      const deniedPaths = perms
        .filter((p) => p.mode === 'deny')
        .flatMap((p) => p.paths);
      expect(deniedPaths).toEqual(
        expect.arrayContaining([
          `${cwd}/apps/back/src/**`,
          `${cwd}/apps/front/src/**`,
          `${cwd}/packages/**`,
        ]),
      );
    });

    it('should allow the sandbox working dir + subdirs', () => {
      const perms = service.buildPermissions('/vfs/session-1');

      const allowed = perms.filter((p) => p.mode === 'allow');
      const allowedPaths = allowed.flatMap((p) => p.paths);
      expect(allowedPaths).toEqual(
        expect.arrayContaining(['/vfs/session-1/**']),
      );
    });
  });

  describe('evalJs', () => {
    it('should evaluate math (2+2=4) via QuickJS', async () => {
      quickJsEval.mockResolvedValue('4');
      const result = await service.evalJs('2 + 2');
      expect(result).toBe('4');
      expect(quickJsEval).toHaveBeenCalledWith('2 + 2');
    });

    it('should fall back to Node vm when QuickJS throws (KA_SANDBOX_ISOLATED_VM=false)', async () => {
      service['configEngine'] = 'vm';
      service['vmEval'] = jest.fn().mockResolvedValue('42');
      const result = await service.evalJs('40 + 2');
      expect(result).toBe('42');
      expect(service['vmEval']).toHaveBeenCalledWith('40 + 2');
    });

    it('should reject network access in vm eval (no require/http)', async () => {
      service['configEngine'] = 'vm';
      // Do NOT stub vmEval — let the real method run assertNoNetwork.
      await expect(service.evalJs("require('http')")).rejects.toThrow();
    });
  });
});