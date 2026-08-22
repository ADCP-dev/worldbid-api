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
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AgentConfigRepository } from './infrastructure/agent-config.repository';
import { CreateAgentConfigDto } from './dto/create-agent-config.dto';
import { UpdateAgentConfigDto } from './dto/update-agent-config.dto';
import { AgentConfig } from './domain/agent-config';
import { JwtAuth } from '@iam/auth/decorators/auth.decorator';
import { UserId } from '@iam/auth/decorators/current-user.decorator';

@ApiTags('Knowledge Agent Configs')
@JwtAuth()
@Controller({
  path: 'ka/agent-configs',
  version: '1',
})
export class AgentConfigController {
  constructor(private readonly repository: AgentConfigRepository) {}

  @Post()
  @ApiCreatedResponse({ type: AgentConfig })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateAgentConfigDto,
    @UserId() userId: number,
  ): Promise<AgentConfig> {
    return this.repository.create({ ...dto, userId });
  }

  @Get()
  @ApiOkResponse({ type: [AgentConfig] })
  findAll(@UserId() userId: number): Promise<AgentConfig[]> {
    return this.repository.findByUserId(userId);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: AgentConfig })
  async findById(
    @Param('id') id: string,
    @UserId() userId: number,
  ): Promise<AgentConfig | null> {
    const cfg = await this.repository.findById(id);
    if (!cfg || cfg.userId !== userId) return null;
    return cfg;
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: AgentConfig })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAgentConfigDto,
    @UserId() userId: number,
  ): Promise<AgentConfig | null> {
    const cfg = await this.repository.findById(id);
    if (!cfg || cfg.userId !== userId) return null;
    return this.repository.update(id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @UserId() userId: number,
  ): Promise<void> {
    const cfg = await this.repository.findById(id);
    if (!cfg || cfg.userId !== userId) return;
    await this.repository.remove(id);
  }
}