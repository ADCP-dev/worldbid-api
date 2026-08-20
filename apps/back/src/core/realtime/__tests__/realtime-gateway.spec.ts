import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealtimeGateway } from '../realtime.gateway';
import { EventEmitterTransport } from '../realtime.transport';
import type { RealtimeClient, RealtimeEvent } from '../realtime.types';
import type { AuthenticatedUser, ResourceSpec } from '../../spec-engine/spec.types';

vi.mock('@nestjs/common', () => ({
  Injectable: () => () => {},
  Logger: class {
    log() {}
    warn() {}
    error() {}
    debug() {}
  },
}));

vi.mock('@nestjs/jwt', () => ({
  JwtService: class {
    async verifyAsync(): Promise<{ id: number; role: { id: number; name: string }; sessionId: string; language: string; iat: number; exp: number }> {
      return {
        id: 1,
        role: { id: 1, name: 'admin' },
        sessionId: 'sess-1',
        language: 'en',
        iat: 0,
        exp: 9999999999,
      };
    }
  },
}));

function makeClient(id: string, token?: string, user?: AuthenticatedUser | null): RealtimeClient {
  const handlers: Record<string, ((data: unknown) => void)[]> = {};
  const joined = new Set<string>();
  return {
    id,
    data: { user: user ?? null },
    handshake: { query: token ? { token } : {} },
    join: vi.fn((ch: string) => joined.add(ch)),
    leave: vi.fn((ch: string) => joined.delete(ch)),
    emit: vi.fn((event: string, data: unknown) => {
      (handlers[event] ?? []).forEach((h) => h(data));
    }),
    disconnect: vi.fn(),
  };
}

function makeUser(roleName: string, id = 1): AuthenticatedUser {
  return {
    id,
    role: { id: 1, name: roleName },
    sessionId: 'sess-1',
    language: 'en',
    iat: 0,
    exp: 9999999999,
  };
}

const mockJwtService = {
  verifyAsync: vi.fn().mockResolvedValue({
    id: 1,
    role: { id: 1, name: 'admin' },
    sessionId: 'sess-1',
    language: 'en',
    iat: 0,
    exp: 9999999999,
  }),
} as unknown as import('@nestjs/jwt').JwtService;

const specMap = new Map<string, ResourceSpec>();
const specLoader = {
  load: vi.fn().mockReturnValue([]),
} as unknown as import('../../spec-engine/spec-loader').SpecLoader;

function getResourceSpec(channel: string): ResourceSpec | undefined {
  for (const spec of specMap.values()) {
    if ((spec.realtime?.channel ?? spec.name) === channel) return spec;
  }
  return undefined;
}

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let transport: EventEmitterTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    transport = new EventEmitterTransport();
    specMap.clear();
    gateway = new RealtimeGateway(mockJwtService, transport, specLoader);
    (gateway as unknown as { specRegistry: Map<string, ResourceSpec> }).specRegistry = specMap;
  });

  describe('handleConnection', () => {
    it('autentica con token válido y guarda user', async () => {
      const client = makeClient('c1', 'valid-token');
      await gateway.handleConnection(client);
      expect(client.data.user).not.toBeNull();
      expect(client.data.user?.id).toBe(1);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('desconecta cliente con token inválido', async () => {
      mockJwtService.verifyAsync.mockRejectedValueOnce(new Error('invalid'));
      const client = makeClient('c2', 'bad-token');
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
      expect(client.data.user).toBeNull();
    });

    it('desconecta cliente sin token', async () => {
      const client = makeClient('c3');
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleSubscribe', () => {
    it('permite subscribe cuando user tiene permiso read', () => {
      const user = makeUser('user');
      const client = makeClient('c1', 'token', user);
      const spec: ResourceSpec = {
        name: 'task',
        table: 'ext_tasks_task',
        fields: [],
        permissions: { read: ['admin', 'user'] },
        realtime: { events: ['insert'], channel: 'tasks' },
      };
      specMap.set('task', spec);

      gateway.handleSubscribe(client, { channel: 'tasks' });
      expect(client.join).toHaveBeenCalledWith('tasks');
      expect(client.emit).not.toHaveBeenCalledWith('error', expect.anything());
    });

    it('deniega subscribe cuando user no tiene permiso read', () => {
      const user = makeUser('guest');
      const client = makeClient('c2', 'token', user);
      const spec: ResourceSpec = {
        name: 'task',
        table: 'ext_tasks_task',
        fields: [],
        permissions: { read: ['admin'] },
        realtime: { events: ['insert'], channel: 'tasks' },
      };
      specMap.set('task', spec);

      gateway.handleSubscribe(client, { channel: 'tasks' });
      expect(client.emit).toHaveBeenCalledWith('error', expect.objectContaining({ message: 'Permission denied' }));
      expect(client.join).not.toHaveBeenCalled();
    });

    it('admin override: admin siempre puede subscribirse', () => {
      const user = makeUser('admin');
      const client = makeClient('c3', 'token', user);
      const spec: ResourceSpec = {
        name: 'task',
        table: 'ext_tasks_task',
        fields: [],
        permissions: { read: ['user'] },
        realtime: { events: ['insert'], channel: 'tasks' },
      };
      specMap.set('task', spec);

      gateway.handleSubscribe(client, { channel: 'tasks' });
      expect(client.join).toHaveBeenCalledWith('tasks');
    });

    it('fail-closed: sin permissions.read deniega', () => {
      const user = makeUser('user');
      const client = makeClient('c4', 'token', user);
      const spec: ResourceSpec = {
        name: 'task',
        table: 'ext_tasks_task',
        fields: [],
        realtime: { events: ['insert'], channel: 'tasks' },
      };
      specMap.set('task', spec);

      gateway.handleSubscribe(client, { channel: 'tasks' });
      expect(client.emit).toHaveBeenCalledWith('error', expect.anything());
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handleUnsubscribe', () => {
    it('ejecuta leave del canal', () => {
      const user = makeUser('user');
      const client = makeClient('c1', 'token', user);
      gateway.handleUnsubscribe(client, { channel: 'tasks' });
      expect(client.leave).toHaveBeenCalledWith('tasks');
    });
  });

  describe('broadcastChange', () => {
    it('envía evento a todos los clientes del room sin rowLevel', () => {
      const user = makeUser('user');
      const client = makeClient('c1', 'token', user);
      const spec: ResourceSpec = {
        name: 'task',
        table: 'ext_tasks_task',
        fields: [],
        permissions: { read: ['user'] },
        realtime: { events: ['insert'], channel: 'tasks' },
      };
      specMap.set('task', spec);
      transport.joinRoom('tasks', client);

      const event: RealtimeEvent = {
        event: 'insert',
        resource: 'task',
        id: 1,
        data: { id: 1, title: 'Test' },
      };

      gateway.broadcastChange('tasks', event);
      expect(client.emit).toHaveBeenCalledWith('change', event);
    });

    it('rowLevel server: filtra eventos que no cumplen el filter', () => {
      const user = makeUser('user', 5);
      const client = makeClient('c1', 'token', user);
      const spec: ResourceSpec = {
        name: 'task',
        table: 'ext_tasks_task',
        fields: [{ name: 'assigneeId', type: 'integer' }],
        permissions: {
          read: ['user'],
          rowLevel: { user: { filter: 'assigneeId == ${user.id}' } },
        },
        realtime: { events: ['insert'], channel: 'tasks', rowLevelFiltering: 'server' },
      };
      specMap.set('task', spec);
      transport.joinRoom('tasks', client);

      const event: RealtimeEvent = {
        event: 'insert',
        resource: 'task',
        id: 1,
        data: { id: 1, assigneeId: 10 },
      };

      gateway.broadcastChange('tasks', event);
      expect(client.emit).not.toHaveBeenCalled();
    });

    it('rowLevel server: permite eventos que cumplen el filter', () => {
      const user = makeUser('user', 10);
      const client = makeClient('c1', 'token', user);
      const spec: ResourceSpec = {
        name: 'task',
        table: 'ext_tasks_task',
        fields: [{ name: 'assigneeId', type: 'integer' }],
        permissions: {
          read: ['user'],
          rowLevel: { user: { filter: 'assigneeId == ${user.id}' } },
        },
        realtime: { events: ['insert'], channel: 'tasks', rowLevelFiltering: 'server' },
      };
      specMap.set('task', spec);
      transport.joinRoom('tasks', client);

      const event: RealtimeEvent = {
        event: 'insert',
        resource: 'task',
        id: 1,
        data: { id: 1, assigneeId: 10 },
      };

      gateway.broadcastChange('tasks', event);
      expect(client.emit).toHaveBeenCalledWith('change', expect.objectContaining({ id: 1 }));
    });

    it('field-level scrub remueve campos no permitidos', () => {
      const user = makeUser('user');
      const client = makeClient('c1', 'token', user);
      const spec: ResourceSpec = {
        name: 'task',
        table: 'ext_tasks_task',
        fields: [
          { name: 'title', type: 'string' },
          { name: 'salary', type: 'integer' },
        ],
        permissions: {
          read: ['user'],
          fields: {
            salary: { read: ['admin'] },
          },
        },
        realtime: { events: ['insert'], channel: 'tasks' },
      };
      specMap.set('task', spec);
      transport.joinRoom('tasks', client);

      const event: RealtimeEvent = {
        event: 'insert',
        resource: 'task',
        id: 1,
        data: { id: 1, title: 'Test', salary: 50000 },
      };

      gateway.broadcastChange('tasks', event);
      const sentEvent = (client.emit as unknown as jest.Mock).mock.calls.find(
        (c: unknown[]) => c[0] === 'change',
      )?.[1] as RealtimeEvent;
      expect(sentEvent).toBeDefined();
      expect(sentEvent.data).toBeDefined();
      expect(sentEvent.data!.salary).toBeUndefined();
      expect(sentEvent.data!.title).toBe('Test');
    });
  });
});