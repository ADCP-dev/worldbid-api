import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { DraftService } from '@ext/content-pipeline/services/draft.service';
import { UpdateDraftDto } from '@ext/content-pipeline/dto/update-draft.dto';
import { RejectDraftDto } from '@ext/content-pipeline/dto/reject-draft.dto';

@ApiTags('Content-Pipeline')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'content-pipeline', version: '1' })
export class DraftController {
  constructor(private readonly draftService: DraftService) {}

  @Get('projects/:projectId/drafts')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  findAllByProject(
    @Param('projectId') projectId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.draftService.findAllByProject(
      projectId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      status,
    );
  }

  @Get('drafts/:id')
  findById(@Param('id') id: string) {
    return this.draftService.findById(id);
  }

  @Patch('drafts/:id')
  update(@Param('id') id: string, @Body() dto: UpdateDraftDto) {
    return this.draftService.update(id, dto);
  }

  @Post('drafts/:id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@Param('id') id: string) {
    return this.draftService.approve(id);
  }

  @Post('drafts/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@Param('id') id: string, @Body() dto: RejectDraftDto) {
    return this.draftService.reject(id, dto.reason);
  }

  @Post('drafts/:id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Param('id') id: string) {
    return this.draftService.publish(id);
  }
}