import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatSessionRepository } from '../chat-session.repository';
import { AgentConfigRepository } from '../agent-config.repository';
import { AgentFactoryService } from '../agent/agent-factory.service';
import { RagService } from '../rag.service';
import { CheckpointerService } from './checkpointer.service';
import type { ChatSession } from '../../domain/chat-session';
import type { AgentConfig } from '../../domain/agent-config';

const makeSession = (overrides: Partial<ChatSession> = {}): ChatSession =>
  ({
    id: 'sess-1',
    userId: 1,
    agentConfigId: 'cfg-1',
    title: 'New Chat',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }) as ChatSession;

const makeConfig = (overrides: Partial<AgentConfig> = {}): AgentConfig =>
  ({
    id: 'cfg-default',
    name: 'Default',
    systemPrompt: 'You are helpful.',
    model: 'openrouter:z-ai/glm-5.2',
    provider: 'openrouter',
    permissions: { allow: [], deny: [] },
    mcpServerIds: [],
    userId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as AgentConfig;

describe('ChatService', () => {
  let service: ChatService;
  let sessionRepo: jest.Mocked<ChatSessionRepository>;
  let agentConfigRepo: jest.Mocked<AgentConfigRepository>;
  let agentFactory: jest.Mocked<AgentFactoryService>;
  let ragService: jest.Mocked<RagService>;
  let checkpointer: jest.Mocked<CheckpointerService>;

  beforeEach(async () => {
    const sessionRepoMock = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      verifyOwnership: jest.fn(),
    };
    const agentConfigRepoMock = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
    };
    const agentFactoryMock = {
      buildAgent: jest.fn(),
    };
    const ragServiceMock = {
      search: jest.fn(),
    };
    const checkpointerMock = {
      getCheckpointer: jest.fn().mockReturnValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: ChatSessionRepository, useValue: sessionRepoMock },
        { provide: AgentConfigRepository, useValue: agentConfigRepoMock },
        { provide: AgentFactoryService, useValue: agentFactoryMock },
        { provide: RagService, useValue: ragServiceMock },
        { provide: CheckpointerService, useValue: checkpointerMock },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    sessionRepo = module.get(
      ChatSessionRepository,
    ) as jest.Mocked<ChatSessionRepository>;
    agentConfigRepo = module.get(
      AgentConfigRepository,
    ) as jest.Mocked<AgentConfigRepository>;
    agentFactory = module.get(
      AgentFactoryService,
    ) as jest.Mocked<AgentFactoryService>;
    ragService = module.get(RagService) as jest.Mocked<RagService>;
    checkpointer = module.get(
      CheckpointerService,
    ) as jest.Mocked<CheckpointerService>;
  });

  afterEach(() => jest.clearAllMocks());

  describe('createSession', () => {
    it('should create a session with the user_id and return it', async () => {
      const session = makeSession();
      sessionRepo.create.mockResolvedValue(session);

      const result = await service.createSession(1, {
        agentConfigId: 'cfg-1',
      });

      expect(sessionRepo.create).toHaveBeenCalledWith({
        userId: 1,
        agentConfigId: 'cfg-1',
      });
      expect(result).toBe(session);
    });

    it('should create a session with default title when none provided', async () => {
      const session = makeSession({ title: 'New Chat' });
      sessionRepo.create.mockResolvedValue(session);

      const result = await service.createSession(1, {});

      expect(result.title).toBe('New Chat');
    });
  });

  describe('listSessions', () => {
    it('should return only the sessions belonging to the user', async () => {
      const sessions = [
        makeSession({ id: 's1' }),
        makeSession({ id: 's2' }),
      ];
      sessionRepo.findByUserId.mockResolvedValue(sessions);

      const result = await service.listSessions(1);

      expect(sessionRepo.findByUserId).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(2);
      expect(result).toEqual(sessions);
    });
  });

  describe('getSession', () => {
    it('should return the session when it belongs to the user', async () => {
      const session = makeSession({ id: 'sess-1', userId: 1 });
      sessionRepo.findById.mockResolvedValue(session);

      const result = await service.getSession('sess-1', 1);

      expect(sessionRepo.findById).toHaveBeenCalledWith('sess-1');
      expect(result).toBe(session);
    });

    it('should return null when the session belongs to another user', async () => {
      const session = makeSession({ id: 'sess-1', userId: 999 });
      sessionRepo.findById.mockResolvedValue(session);

      const result = await service.getSession('sess-1', 1);

      expect(result).toBeNull();
    });

    it('should return null when the session does not exist', async () => {
      sessionRepo.findById.mockResolvedValue(null);

      const result = await service.getSession('missing', 1);

      expect(result).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should update the session when it belongs to the user', async () => {
      const session = makeSession({ id: 'sess-1', userId: 1, title: 'New' });
      const updated = makeSession({ id: 'sess-1', userId: 1, title: 'Renamed' });
      sessionRepo.findById.mockResolvedValue(session);
      sessionRepo.update.mockResolvedValue(updated);

      const result = await service.updateSession('sess-1', 1, {
        title: 'Renamed',
      });

      expect(sessionRepo.update).toHaveBeenCalledWith('sess-1', {
        title: 'Renamed',
      });
      expect(result).toBe(updated);
    });

    it('should throw ForbiddenException when the session belongs to another user', async () => {
      const session = makeSession({ id: 'sess-1', userId: 999 });
      sessionRepo.findById.mockResolvedValue(session);

      await expect(
        service.updateSession('sess-1', 1, { title: 'X' }),
      ).rejects.toThrow(ForbiddenException);
      expect(sessionRepo.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the session does not exist', async () => {
      sessionRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateSession('missing', 1, { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteSession', () => {
    it('should delete the session when it belongs to the user', async () => {
      const session = makeSession({ id: 'sess-1', userId: 1 });
      sessionRepo.findById.mockResolvedValue(session);
      sessionRepo.remove.mockResolvedValue(undefined);

      await service.deleteSession('sess-1', 1);

      expect(sessionRepo.remove).toHaveBeenCalledWith('sess-1');
    });

    it('should throw ForbiddenException when the session belongs to another user', async () => {
      const session = makeSession({ id: 'sess-1', userId: 999 });
      sessionRepo.findById.mockResolvedValue(session);

      await expect(service.deleteSession('sess-1', 1)).rejects.toThrow(
        ForbiddenException,
      );
      expect(sessionRepo.remove).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the session does not exist', async () => {
      sessionRepo.findById.mockResolvedValue(null);

      await expect(service.deleteSession('missing', 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('sendMessage', () => {
    function makeAsyncIterable(chunks: string[]): AsyncIterable<string> {
      return {
        [Symbol.asyncIterator]() {
          let i = 0;
          return {
            next(): Promise<IteratorResult<string>> {
              if (i < chunks.length) {
                return Promise.resolve({ value: chunks[i++], done: false });
              }
              return Promise.resolve({ value: undefined, done: true });
            },
          };
        },
      };
    }

    function makeStreamRun(chunks: string[]) {
      const textIterable = makeAsyncIterable(chunks);
      const messagesIterable = {
        [Symbol.asyncIterator]() {
          let yielded = false;
          return {
            next(): Promise<IteratorResult<{ text: AsyncIterable<string> }>> {
              if (!yielded) {
                yielded = true;
                return Promise.resolve({ value: { text: textIterable }, done: false });
              }
              return Promise.resolve({ value: undefined, done: true });
            },
          };
        },
      };
      return { messages: messagesIterable };
    }

    function makeAgent(streamRun: unknown) {
      return {
        streamEvents: jest.fn().mockResolvedValue(streamRun),
      };
    }

    it('should build the agent and stream the response tokens', async () => {
      const session = makeSession({ id: 'sess-1', userId: 1, agentConfigId: 'cfg-1' });
      sessionRepo.findById.mockResolvedValue(session);
      const agent = makeAgent(makeStreamRun(['Hello', ' world']));
      agentFactory.buildAgent.mockResolvedValue(agent);
      ragService.search.mockResolvedValue([]);

      const chunks: string[] = [];
      for await (const c of service.sendMessage('sess-1', 1, 'Hi')) {
        chunks.push(c);
      }

      expect(agentFactory.buildAgent).toHaveBeenCalledWith('cfg-1', 1);
      expect(agent.streamEvents).toHaveBeenCalled();
      expect(chunks).toEqual(['Hello', ' world']);
    });

    it('should return null (403) when the session belongs to another user', async () => {
      const session = makeSession({ id: 'sess-1', userId: 999 });
      sessionRepo.findById.mockResolvedValue(session);

      const result = service.sendMessage('sess-1', 1, 'Hi');
      const chunks: string[] = [];
      for await (const c of result) {
        chunks.push(c);
      }

      expect(chunks).toEqual([]);
      expect(agentFactory.buildAgent).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the session does not exist', async () => {
      sessionRepo.findById.mockResolvedValue(null);

      await expect(
        (async () => {
          for await (const _ of service.sendMessage('missing', 1, 'Hi')) {
            void _;
          }
        })(),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use the default agent config when agentConfigId is null', async () => {
      const session = makeSession({
        id: 'sess-1',
        userId: 1,
        agentConfigId: null,
      });
      sessionRepo.findById.mockResolvedValue(session);
      const defaultConfig = makeConfig({ id: 'cfg-default', userId: 1 });
      agentConfigRepo.findByUserId.mockResolvedValue([defaultConfig]);
      const agent = makeAgent(makeStreamRun(['ok']));
      agentFactory.buildAgent.mockResolvedValue(agent);
      ragService.search.mockResolvedValue([]);

      const chunks: string[] = [];
      for await (const c of service.sendMessage('sess-1', 1, 'Hi')) {
        chunks.push(c);
      }

      expect(agentConfigRepo.findByUserId).toHaveBeenCalledWith(1);
      expect(agentFactory.buildAgent).toHaveBeenCalledWith('cfg-default', 1);
      expect(chunks).toEqual(['ok']);
    });

    it('should throw NotFoundException when agentConfigId is null and no default config exists', async () => {
      const session = makeSession({
        id: 'sess-1',
        userId: 1,
        agentConfigId: null,
      });
      sessionRepo.findById.mockResolvedValue(session);
      agentConfigRepo.findByUserId.mockResolvedValue([]);

      await expect(
        (async () => {
          for await (const _ of service.sendMessage('sess-1', 1, 'Hi')) {
            void _;
          }
        })(),
      ).rejects.toThrow(NotFoundException);
    });

    it('should inject RAG context before the user message', async () => {
      const session = makeSession({ id: 'sess-1', userId: 1, agentConfigId: 'cfg-1' });
      sessionRepo.findById.mockResolvedValue(session);
      const agent = makeAgent(makeStreamRun(['ans']));
      agentFactory.buildAgent.mockResolvedValue(agent);
      ragService.search.mockResolvedValue([
        {
          id: 'n1',
          title: 'Note A',
          contentMd: 'important context',
          categoryPath: null,
          tags: [],
          score: 0.1,
          source: 'semantic',
        },
      ]);

      for await (const _ of service.sendMessage('sess-1', 1, 'question')) {
        void _;
      }

      expect(ragService.search).toHaveBeenCalled();
      const call = agent.streamEvents.mock.calls[0][0];
      const content = call.messages[0].content as string;
      expect(content).toContain('question');
      expect(content).toContain('important context');
    });
  });

  describe('streamMessage', () => {
    function makeAsyncIterable(chunks: string[]): AsyncIterable<string> {
      return {
        [Symbol.asyncIterator]() {
          let i = 0;
          return {
            next(): Promise<IteratorResult<string>> {
              if (i < chunks.length) {
                return Promise.resolve({ value: chunks[i++], done: false });
              }
              return Promise.resolve({ value: undefined, done: true });
            },
          };
        },
      };
    }

    function makeStreamRun(chunks: string[]) {
      const textIterable = makeAsyncIterable(chunks);
      const messagesIterable = {
        [Symbol.asyncIterator]() {
          let yielded = false;
          return {
            next(): Promise<IteratorResult<{ text: AsyncIterable<string> }>> {
              if (!yielded) {
                yielded = true;
                return Promise.resolve({ value: { text: textIterable }, done: false });
              }
              return Promise.resolve({ value: undefined, done: true });
            },
          };
        },
      };
      return { messages: messagesIterable };
    }

    function makeAgent(streamRun: unknown) {
      return {
        streamEvents: jest.fn().mockResolvedValue(streamRun),
      };
    }

    it('should be an async iterable that yields the same tokens as sendMessage', async () => {
      const session = makeSession({ id: 'sess-1', userId: 1, agentConfigId: 'cfg-1' });
      sessionRepo.findById.mockResolvedValue(session);
      const agent = makeAgent(makeStreamRun(['A', 'B', 'C']));
      agentFactory.buildAgent.mockResolvedValue(agent);
      ragService.search.mockResolvedValue([]);

      const chunks: string[] = [];
      for await (const c of service.streamMessage('sess-1', 1, 'Hi')) {
        chunks.push(c);
      }

      expect(chunks).toEqual(['A', 'B', 'C']);
    });
  });
});