import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ChatSessionController } from './chat-session.controller';
import { ChatService } from './infrastructure/chat/chat.service';
import type { ChatSession } from './domain/chat-session';

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

describe('ChatSessionController', () => {
  let controller: ChatSessionController;
  let chatService: jest.Mocked<ChatService>;

  beforeEach(async () => {
    const mockService = {
      createSession: jest.fn(),
      listSessions: jest.fn(),
      getSession: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      streamMessage: jest.fn(),
      getSessionHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatSessionController],
      providers: [{ provide: ChatService, useValue: mockService }],
    }).compile();

    controller = module.get<ChatSessionController>(ChatSessionController);
    chatService = module.get(ChatService) as unknown as jest.Mocked<ChatService>;
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createSession', () => {
    it('should create a session for the authenticated user', async () => {
      const session = makeSession();
      chatService.createSession.mockResolvedValue(session);

      const result = await controller.create(
        { agentConfigId: 'cfg-1' },
        1,
      );

      expect(chatService.createSession).toHaveBeenCalledWith(1, {
        agentConfigId: 'cfg-1',
      });
      expect(result).toBe(session);
    });
  });

  describe('findAll', () => {
    it('should list only the user sessions', async () => {
      const sessions = [makeSession({ id: 's1' }), makeSession({ id: 's2' })];
      chatService.listSessions.mockResolvedValue(sessions);

      const result = await controller.findAll(1);

      expect(chatService.listSessions).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return the session when it belongs to the user', async () => {
      const session = makeSession({ id: 'sess-1', userId: 1 });
      chatService.getSession.mockResolvedValue(session);

      const result = await controller.findOne('sess-1', 1);

      expect(chatService.getSession).toHaveBeenCalledWith('sess-1', 1);
      expect(result).toBe(session);
    });

    it('should return null when the session belongs to another user (no leak)', async () => {
      chatService.getSession.mockResolvedValue(null);

      const result = await controller.findOne('sess-1', 1);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update the session when it belongs to the user', async () => {
      const updated = makeSession({ id: 'sess-1', title: 'Renamed' });
      chatService.updateSession.mockResolvedValue(updated);

      const result = await controller.update('sess-1', 1, { title: 'Renamed' });

      expect(chatService.updateSession).toHaveBeenCalledWith('sess-1', 1, {
        title: 'Renamed',
      });
      expect(result).toBe(updated);
    });

    it('should throw NotFoundException when the session does not exist', async () => {
      chatService.updateSession.mockRejectedValue(new NotFoundException());

      await expect(
        controller.update('missing', 1, { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when cross-user', async () => {
      chatService.updateSession.mockRejectedValue(new ForbiddenException());

      await expect(
        controller.update('sess-1', 1, { title: 'X' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete the session when it belongs to the user', async () => {
      chatService.deleteSession.mockResolvedValue(undefined);

      await controller.remove('sess-1', 1);

      expect(chatService.deleteSession).toHaveBeenCalledWith('sess-1', 1);
    });

    it('should throw ForbiddenException when cross-user', async () => {
      chatService.deleteSession.mockRejectedValue(new ForbiddenException());

      await expect(controller.remove('sess-1', 1)).rejects.toThrow(
        ForbiddenException,
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

    /**
     * Mock Express Response collecting every SSE frame written by the
     * controller (manual @Res() SSE — no Observable anymore).
     */
    function makeMockRes(): {
      setHeader: jest.Mock;
      flushHeaders: jest.Mock;
      write: jest.Mock;
      end: jest.Mock;
    } {
      return {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };
    }

    it('should write SSE text frames + done sentinel to the response', async () => {
      const iter = makeAsyncIterable([
        { kind: 'text', text: 'Hello' },
        { kind: 'text', text: ' world' },
      ]);
      chatService.streamMessage.mockReturnValue(iter as never);
      const res = makeMockRes();

      await controller.sendMessage('sess-1', 1, { message: 'Hi' }, res as never);

      expect(chatService.streamMessage).toHaveBeenCalledWith('sess-1', 1, 'Hi', undefined);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      const frames = res.write.mock.calls.map((c) => c[0] as string);
      expect(frames).toEqual([
        'data: Hello\n\n',
        'data:  world\n\n',
        'event: done\ndata: [DONE]\n\n',
      ]);
      expect(res.end).toHaveBeenCalled();
    });

    it('should forward the message body to the service', async () => {
      chatService.streamMessage.mockReturnValue(makeAsyncIterable([]) as never);
      const res = makeMockRes();

      await controller.sendMessage(
        'sess-1',
        1,
        { message: 'What is LangGraph?' },
        res as never,
      );

      expect(chatService.streamMessage).toHaveBeenCalledWith(
        'sess-1',
        1,
        'What is LangGraph?',
        undefined,
      );
    });

    it('should scope the call to the authenticated user id', async () => {
      chatService.streamMessage.mockReturnValue(makeAsyncIterable([]) as never);
      const res = makeMockRes();

      await controller.sendMessage('sess-1', 42, { message: 'Hi' }, res as never);

      expect(chatService.streamMessage).toHaveBeenCalledWith('sess-1', 42, 'Hi', undefined);
    });
  });

  describe('getMessages', () => {
    it('should return the session history for the owner', async () => {
      const history = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      chatService.getSessionHistory.mockResolvedValue(history);

      const result = await controller.getMessages('sess-1', 1);

      expect(chatService.getSessionHistory).toHaveBeenCalledWith('sess-1', 1);
      expect(result).toEqual(history);
    });

    it('should return null when the session belongs to another user', async () => {
      chatService.getSessionHistory.mockResolvedValue(null);

      const result = await controller.getMessages('sess-1', 1);

      expect(result).toBeNull();
    });

    it('should return an empty array for a new session', async () => {
      chatService.getSessionHistory.mockResolvedValue([]);

      const result = await controller.getMessages('sess-new', 1);

      expect(result).toEqual([]);
    });
  });
});