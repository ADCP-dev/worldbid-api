import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { AgentRunService } from '@ext/autonomous-agent/services/agent-run.service';
import { FindAllRunDto } from '@ext/autonomous-agent/dto/find-all-run.dto';

@ApiTags('Autonomous-Agent')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'autonomous-agent/runs', version: '1' })
export class AgentRunController {
  constructor(private readonly runService: AgentRunService) {}

  @Get()
  findAll(@Query() query: FindAllRunDto) {
    return this.runService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.runService.findById(id);
  }
}
