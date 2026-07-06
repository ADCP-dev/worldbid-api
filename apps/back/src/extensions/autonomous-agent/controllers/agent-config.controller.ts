import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { AgentConfigService } from '@ext/autonomous-agent/services/agent-config.service';
import { CreateConfigDto } from '@ext/autonomous-agent/dto/create-config.dto';
import { UpdateConfigDto } from '@ext/autonomous-agent/dto/update-config.dto';
import { FindAllConfigDto } from '@ext/autonomous-agent/dto/find-all-config.dto';

@ApiTags('Autonomous-Agent')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'autonomous-agent/configs', version: '1' })
export class AgentConfigController {
  constructor(private readonly configService: AgentConfigService) {}

  @Get()
  findAll(@Query() query: FindAllConfigDto) {
    return this.configService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.configService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateConfigDto) {
    return this.configService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateConfigDto) {
    return this.configService.update(id, dto);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  pause(@Param('id') id: string) {
    return this.configService.pause(id);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  resume(@Param('id') id: string) {
    return this.configService.resume(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.configService.remove(id);
  }
}
