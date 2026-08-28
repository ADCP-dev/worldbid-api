import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Body,
  Res,
  Sse,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common/interfaces/http/message-event.interface';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ChatService } from './infrastructure/chat/chat.service';
import { CreateChatSessionDto } from './dto/create-chat-session.dto';
import { UpdateChatSessionDto } from './dto/update-chat-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatSession } from './domain/chat-session';
import { JwtAuth } from '@iam/auth/decorators/auth.decorator';
import { UserId } from '@iam/auth/decorators/current-user.decorator';

/**
 * ChatSessionController — per-user chat sessions + SSE message endpoint.
 *
 * Every route is JWT-authenticated and scoped to `@UserId()`. The service
 * enforces ownership (403 cross-user, 404 missing) before any mutation.
 *
 * The `POST /:sessionId/message` endpoint streams the agent response as SSE.
 * NestJS's `@Sse()` decorator only supports GET, so the message endpoint uses
 * the standard NestJS SSE pattern with an `Observable<MessageEvent>`: the
 * async iterable from `chatService.streamMessage` is mapped to SSE events,
 * each carrying a text delta in `data`.
 */
@ApiTags('Knowledge Chat Sessions')
@JwtAuth()
@Controller({
  path: 'ka/chat/sessions',
  version: '1',
})
export class ChatSessionController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiCreatedResponse({ type: ChatSession })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateChatSessionDto,
    @UserId() userId: number,
  ): Promise<ChatSession> {
    return this.chatService.createSession(userId, dto);
  }

  @Get()
  @ApiOkResponse({ type: [ChatSession] })
  findAll(@UserId() userId: number): Promise<ChatSession[]> {
    return this.chatService.listSessions(userId);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: ChatSession })
  findOne(
    @Param('id') id: string,
    @UserId() userId: number,
  ): Promise<ChatSession | null> {
    return this.chatService.getSession(id, userId);
  }

  /**
   * Return the persisted conversation history for a session, sourced from the
   * PostgresSaver checkpointer. Only the session owner can read it; cross-user
   * access returns null (no leak of session existence).
   *
   * Each entry is `{ role: 'user' | 'assistant', content }` in chronological
   * order. A new session (no checkpoint yet) returns an empty array.
   */
  @Get(':id/messages')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({
    description: 'Persisted conversation messages in chronological order.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['user', 'assistant'] },
          content: { type: 'string' },
        },
      },
    },
  })
  getMessages(
    @Param('id') id: string,
    @UserId() userId: number,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }> | null> {
    return this.chatService.getSessionHistory(id, userId);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: ChatSession })
  update(
    @Param('id') id: string,
    @UserId() userId: number,
    @Body() dto: UpdateChatSessionDto,
  ): Promise<ChatSession> {
    return this.chatService.updateSession(id, userId, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @UserId() userId: number): Promise<void> {
    return this.chatService.deleteSession(id, userId);
  }

  /**
   * Send a message to the chat session. The message is saved and the agent
   * run is queued. Returns 200 immediately so the client can open the SSE
   * stream via GET :sessionId/stream.
   *
   * Two-step design: NestJS @Sse() only supports GET, so we split the write
   * (POST message) from the stream (GET stream) to stay within the official
   * NestJS SSE pattern.
   */
  @Post(':sessionId/message')
  @ApiParam({ name: 'sessionId', type: String })
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @UserId() userId: number,
    @Body() dto: SendMessageDto,
  ): Promise<{ ok: true }> {
    // Queue the stream. The actual agent run starts when the client opens
    // the GET SSE endpoint. We store the pending message so the GET
    // handler can pick it up.
    this.pendingMessages.set(`${sessionId}:${userId}`, dto.message);
    return { ok: true };
  }

  /**
   * SSE stream for the pending message (set by POST :sessionId/message).
   * Uses the official NestJS @Sse() decorator which sets the correct
   * Content-Type: text/event-stream headers and keeps the connection open.
   */
  @Sse(':sessionId/stream')
  @ApiParam({ name: 'sessionId', type: String })
  streamMessage(
    @Param('sessionId') sessionId: string,
    @UserId() userId: number,
  ): Observable<MessageEvent> {
    const key = `${sessionId}:${userId}`;
    const message = this.pendingMessages.get(key) ?? '';
    this.pendingMessages.delete(key);

    const iterable = this.chatService.streamMessage(
      sessionId,
      userId,
      message,
    );
    return this.toSseObservable(iterable);
  }

  /** Pending messages from POST, keyed by sessionId:userId. */
  private readonly pendingMessages = new Map<string, string>();

  /**
   * Convert an async iterable of structured chunks into an RxJS Observable of
   * SSE `MessageEvent` objects. NestJS detects an `Observable<MessageEvent>`
   * return type and wires the SSE response headers automatically.
   *
   * Wire format produced:
   *   - text        → `data: <token>` (plain, old clients keep working)
   *   - tool_call   → `event: tool_call` + `data: <json>` lines
   *   - tool_result → `event: tool_result` + `data: <json>` lines
   *   - done        → `event: done`    + `data: [DONE]`
   */
  private toSseObservable(
    iterable: AsyncIterable<
      import('./infrastructure/chat/chat.service').ChatStreamChunk
    >,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      void (async () => {
        try {
          for await (const chunk of iterable) {
            if (chunk.kind === 'text') {
              subscriber.next({ data: chunk.text });
            } else if (chunk.kind === 'tool_call') {
              subscriber.next({
                type: 'tool_call',
                data: JSON.stringify({
                  name: chunk.name,
                  args: chunk.args ?? {},
                  id: chunk.id,
                }),
              });
            } else if (chunk.kind === 'tool_result') {
              subscriber.next({
                type: 'tool_result',
                data: JSON.stringify({
                  name: chunk.name,
                  output: chunk.output ?? '',
                  id: chunk.id,
                }),
              });
            }
          }
          // Sentinel event so the client knows the stream is done.
          subscriber.next({ type: 'done', data: '[DONE]' });
          subscriber.complete();
        } catch (err) {
          // Log the full error so the 500 is debuggable — NestJS swallows
          // Observable errors silently otherwise.
          console.error('[ChatSession] SSE stream error:', err);
          subscriber.error(err);
        }
      })();
    });
  }
}
