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
  Res,
} from '@nestjs/common';
import { Response } from 'express';
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
   * Send a message and stream the agent response as Server-Sent Events.
   *
   * Uses @Post with manual SSE writing via @Res() instead of the @Sse()
   * decorator (which only supports GET and can't receive a POST body).
   * The response is flushed with text/event-stream headers and each chunk
   * is written as an SSE frame.
   */
  @Post(':sessionId/message')
  @ApiParam({ name: 'sessionId', type: String })
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @UserId() userId: number,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const iterable = this.chatService.streamMessage(
        sessionId,
        userId,
        dto.message,
        dto.attachments,
      );
      for await (const chunk of iterable) {
        if (chunk.kind === 'text') {
          res.write(`data: ${chunk.text}\n\n`);
        } else if (chunk.kind === 'tool_call') {
          res.write(`event: tool_call\ndata: ${JSON.stringify({ name: chunk.name, args: chunk.args ?? {}, id: chunk.id })}\n\n`);
        } else if (chunk.kind === 'tool_result') {
          res.write(`event: tool_result\ndata: ${JSON.stringify({ name: chunk.name, output: chunk.output ?? '', id: chunk.id })}\n\n`);
        }
      }
      res.write(`event: done\ndata: [DONE]\n\n`);
      res.end();
    } catch (err) {
      console.error('[ChatSession] SSE stream error:', err);
      res.write(`event: error\ndata: ${JSON.stringify({ message: err instanceof Error ? err.message : String(err) })}\n\n`);
      res.end();
    }
  }

}
