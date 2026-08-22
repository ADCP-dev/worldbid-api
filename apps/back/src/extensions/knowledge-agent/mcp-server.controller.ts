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
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { McpServerRepository } from '../infrastructure/mcp-server.repository';
import { CreateMcpServerDto } from '../dto/create-mcp-server.dto';
import { UpdateMcpServerDto } from '../dto/update-mcp-server.dto';
import { McpServer } from '../domain/mcp-server';
import { JwtAuth } from '@iam/auth/decorators/auth.decorator';

/**
 * MCP servers are admin-managed. All authenticated users may list/inspect
 * them (needed to populate the agent-config MCP select).
 */
@ApiTags('Knowledge MCP Servers')
@JwtAuth()
@Controller({
  path: 'ka/mcp-servers',
  version: '1',
})
export class McpServerController {
  constructor(private readonly repository: McpServerRepository) {}

  @Post()
  @ApiCreatedResponse({ type: McpServer })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateMcpServerDto): Promise<McpServer> {
    return this.repository.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [McpServer] })
  findAll(@Query('agentConfigId') agentConfigId?: string): Promise<McpServer[]> {
    return this.repository.find();
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: McpServer })
  findById(@Param('id') id: string): Promise<McpServer | null> {
    return this.repository.findById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: McpServer })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMcpServerDto,
  ): Promise<McpServer> {
    return this.repository.update(id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.repository.remove(id);
  }
}