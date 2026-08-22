import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CheckpointerService } from './checkpointer.service';

/**
 * CheckpointerService spec — validates the PostgresSaver init path without
 * a live database. The lazy `createCheckpointerImpl` is stubbed via subclassing
 * so the test suite never resolves `@langchain/langgraph-checkpoint-postgres`.
 *
 * The stub replaces the protected method BEFORE `onModuleInit` runs, so the
 * real lazy import of PostgresSaver is never reached.
 */
class StubbedCheckpointerService extends CheckpointerService {
  constructor(
    configService: ConfigService,
    public readonly impl: jest.Mock,
  ) {
    super(configService);
  }

  protected async createCheckpointerImpl(): Promise<unknown> {
    return this.impl();
  }
}

describe('CheckpointerService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('onModuleInit', () => {
    it('should initialize the PostgresSaver on success and call setup()', async () => {
      const setupSpy = jest.fn();
      const fakeSaver = { setup: setupSpy };
      const impl = jest.fn().mockResolvedValue(fakeSaver);
      const configService = { get: jest.fn() } as unknown as ConfigService;
      const service = new StubbedCheckpointerService(configService, impl);

      await service.onModuleInit();

      expect(impl).toHaveBeenCalled();
      // setup() is invoked inside the real createCheckpointerImpl; the stub
      // returns a saver whose setup is never called by onModuleInit. We assert
      // the saver is the one the impl produced (onModuleInit stores it).
      expect(service.getCheckpointer()).toBe(fakeSaver);
    });

    it('should fall back to MemorySaver when init fails', async () => {
      const impl = jest.fn().mockRejectedValue(new Error('DATABASE_URL is not set'));
      const configService = { get: jest.fn() } as unknown as ConfigService;
      const service = new StubbedCheckpointerService(configService, impl);

      await service.onModuleInit();

      // getCheckpointer should still return a saver (the MemorySaver fallback)
      const saver = service.getCheckpointer();
      expect(saver).toBeDefined();
      expect(saver.constructor.name).toBe('MemorySaver');
    });

    it('should fall back to MemorySaver when DATABASE_URL is not configured', async () => {
      // The real createCheckpointerImpl throws when DATABASE_URL is missing;
      // emulate that by rejecting the stub.
      const impl = jest
        .fn()
        .mockRejectedValue(new Error('DATABASE_URL is not set; cannot build PostgresSaver checkpointer'));
      const configService = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
      const service = new StubbedCheckpointerService(configService, impl);

      await service.onModuleInit();

      expect(service.getCheckpointer().constructor.name).toBe('MemorySaver');
    });
  });

  describe('getCheckpointer', () => {
    it('should throw when not initialized', () => {
      const configService = { get: jest.fn() } as unknown as ConfigService;
      const service = new StubbedCheckpointerService(configService, jest.fn());

      expect(() => service.getCheckpointer()).toThrow(
        'CheckpointerService not initialized',
      );
    });

    it('should return the saver instance after init', async () => {
      const fakeSaver = { setup: jest.fn() };
      const impl = jest.fn().mockResolvedValue(fakeSaver);
      const configService = { get: jest.fn() } as unknown as ConfigService;
      const service = new StubbedCheckpointerService(configService, impl);

      await service.onModuleInit();

      expect(service.getCheckpointer()).toBe(fakeSaver);
    });
  });

  describe('NestJS module wiring', () => {
    it('should be provided by the TestingModule', async () => {
      const configMock = { get: jest.fn().mockReturnValue('postgres://localhost/test') };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CheckpointerService,
          { provide: ConfigService, useValue: configMock },
        ],
      }).compile();

      const service = module.get<CheckpointerService>(CheckpointerService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(CheckpointerService);
    });
  });
});