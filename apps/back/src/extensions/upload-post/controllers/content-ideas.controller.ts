import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { ContentIdeasService } from '@ext/upload-post/services/content-ideas.service';
import {
  CreateContentIdeaDto,
  UpdateContentIdeaDto,
  ReorderIdeasDto,
} from '@ext/upload-post/dto/content-idea.dto';

@ApiTags('Upload-Post')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'upload-post/ideas', version: '1' })
export class ContentIdeasController {
  constructor(private readonly ideasService: ContentIdeasService) {}

  @Get()
  findAll() {
    return this.ideasService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.ideasService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateContentIdeaDto) {
    return this.ideasService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContentIdeaDto) {
    return this.ideasService.update(id, dto);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; order?: number },
  ) {
    return this.ideasService.updateStatus(
      id,
      body.status as any,
      body.order,
    );
  }

  @Post('reorder')
  @HttpCode(HttpStatus.OK)
  reorder(@Body() dto: ReorderIdeasDto) {
    return this.ideasService.reorder(dto.orderedIds);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string) {
    return this.ideasService.delete(id);
  }
}