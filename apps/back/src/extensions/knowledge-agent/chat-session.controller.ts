import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Body,
  Res,
  StreamableFile,
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
          // SSE requires one `data:` line PER payload line. Streamed tokens
          // are raw markdown fragments that frequently contain '\n' — writing
          // them raw inside a single data frame breaks the frame boundary and
          // the client silently drops every line after the first (markdown
          // looked broken until the page reload re-fetched clean history).
          const dataLines = chunk.text.split('\n').map((l) => `data: ${l}`);
          res.write(`${dataLines.join('\n')}\n\n`);
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

  /**
   * List files the agent created in this session's sandbox (VfsBackend
   * working dir). Powers the chat file chips + viewer.
   */
  @Get(':sessionId/files')
  @ApiParam({ name: 'sessionId', type: String })
  @ApiOkResponse({ type: Array })
  async listFiles(
    @Param('sessionId') sessionId: string,
    @UserId() userId: number,
  ): Promise<
    Array<{ name: string; path: string; size: number; mtime: string; mime: string }>
  > {
    await this.assertOwned(sessionId, userId);
    return this.chatService.listSessionFiles(sessionId);
  }

  /**
   * Download / view a sandbox file. `?download=1` forces attachment;
   * otherwise the browser renders inline (HTML in iframe → the user
   * prints to PDF from the viewer).
   */
  @Get(':sessionId/files/content')
  @ApiParam({ name: 'sessionId', type: String })
  async readSandboxFile(
    @Param('sessionId') sessionId: string,
    @UserId() userId: number,
    @Query('path') path: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    await this.assertOwned(sessionId, userId);
    const file = this.chatService.readSessionFile(sessionId, path);
    const disposition = download === '1' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', file.mime);
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(file.name)}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(file.content);
  }

  /** Verify the session exists AND belongs to the requesting user. */
  private async assertOwned(sessionId: string, userId: number): Promise<void> {
    const session = await this.chatService.getSessionForUser(sessionId, userId);
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    if (session.userId !== userId) throw new ForbiddenException();
  }
}
