import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Body,
} from '@nestjs/common';
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
  remove(
    @Param('id') id: string,
    @UserId() userId: number,
  ): Promise<void> {
    return this.chatService.deleteSession(id, userId);
  }

  /**
   * Send a message and stream the agent response as Server-Sent Events.
   *
   * Each SSE `data` field carries a text delta. The client concatenates
   * them to reconstruct the full assistant message. The stream completes
   * when the agent run finishes (async iterable exhausts).
   */
  @Post(':sessionId/message')
  @ApiParam({ name: 'sessionId', type: String })
  sendMessage(
    @Param('sessionId') sessionId: string,
    @UserId() userId: number,
    @Body() dto: SendMessageDto,
  ): Observable<MessageEvent> {
    const iterable = this.chatService.streamMessage(
      sessionId,
      userId,
      dto.message,
    );
    return this.toSseObservable(iterable);
  }

  /**
   * Convert an async iterable of text deltas into an RxJS Observable of
   * SSE `MessageEvent` objects. NestJS detects an `Observable<MessageEvent>`
   * return type and wires the SSE response headers automatically.
   */
  private toSseObservable(iterable: AsyncIterable<string>): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      void (async () => {
        try {
          for await (const chunk of iterable) {
            subscriber.next({ data: chunk });
          }
          // Sentinel event so the client knows the stream is done.
          subscriber.next({ data: '[DONE]', event: 'done' });
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      })();
    });
  }
}