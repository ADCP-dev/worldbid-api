import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostgresListener } from '../postgres-listener';
import type { RealtimeGateway } from '../realtime.gateway';

vi.mock('@nestjs/common', () => ({
  Injectable: () => () => {},
  Logger: class {
    log() {}
    warn() {}
    error() {}
    debug() {}
  },
}));

const mockClient = {
  connect: vi.fn(),
  query: vi.fn(),
  on: vi.fn(),
  end: vi.fn(),
};

vi.mock('pg', () => {
  class MockPgClient {
    constructor() {
      return mockClient;
    }
  }
  return {
    default: { Client: MockPgClient },
    Client: MockPgClient,
  };
});

const gateway = {
  broadcastChange: vi.fn(),
} as unknown as RealtimeGateway;

const configService = {
  get: vi.fn((key: string) => {
    if (key === 'database.url') return 'postgres://localhost/test';
    return null;
  }),
} as unknown as import('@nestjs/config').ConfigService;

const specLoader = {
  load: vi.fn().mockReturnValue([
    {
      spec: {
        name: 'tasks',
        resources: [
          {
            name: 'task',
            realtime: { events: ['insert'], channel: 'tasks' },
          },
        ],
      },
    },
  ]),
} as unknown as import('../../spec-engine/spec-loader').SpecLoader;

describe('PostgresListener', () => {
  let listener: PostgresListener;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.connect.mockResolvedValue(undefined);
    mockClient.query.mockResolvedValue({ rows: [] });
    listener = new PostgresListener(gateway, configService, specLoader);
  });

  it('onModuleInit connecta y hace LISTEN en canales de realtime', async () => {
    await listener.onModuleInit();
    expect(mockClient.connect).toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith('LISTEN "tasks"');
  });

  it('notification handler parsea JSON y llama broadcastChange', async () => {
    await listener.onModuleInit();
    const onCall = mockClient.on.mock.calls.find((c: unknown[]) => c[0] === 'notification');
    expect(onCall).toBeDefined();
    const handler = onCall![1] as (msg: { channel: string; payload?: string }) => void;
    handler({ channel: 'tasks', payload: JSON.stringify({ event: 'insert', resource: 'task', id: 1 }) });
    expect(gateway.broadcastChange).toHaveBeenCalledWith('tasks', {
      event: 'insert',
      resource: 'task',
      id: 1,
    });
  });

  it('addChannel ejecuta LISTEN', async () => {
    await listener.onModuleInit();
    await listener.addChannel('newchan');
    expect(mockClient.query).toHaveBeenCalledWith('LISTEN "newchan"');
  });

  it('removeChannel ejecuta UNLISTEN', async () => {
    await listener.onModuleInit();
    await listener.removeChannel('tasks');
    expect(mockClient.query).toHaveBeenCalledWith('UNLISTEN "tasks"');
  });

  it('reconnect con backoff exponencial tras caída de conexión', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation((cb: () => void) => {
      cb();
      return 0 as unknown as NodeJS.Timeout;
    });
    await listener.onModuleInit();
    const errorCall = mockClient.on.mock.calls.find((c: unknown[]) => c[0] === 'error');
    expect(errorCall).toBeDefined();
    const errorHandler = errorCall![1] as (err: Error) => void;
    errorHandler(new Error('connection lost'));

    expect(setTimeoutSpy).toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });

  it('onModuleDestroy cierra la conexión', async () => {
    await listener.onModuleInit();
    await listener.onModuleDestroy();
    expect(mockClient.end).toHaveBeenCalled();
  });
});