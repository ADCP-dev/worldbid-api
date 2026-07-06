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
import { ProjectService } from '@ext/content-pipeline/services/project.service';
import { CreateCpProjectDto } from '@ext/content-pipeline/dto/create-project.dto';
import { UpdateCpProjectDto } from '@ext/content-pipeline/dto/update-project.dto';
import { FindAllProjectDto } from '@ext/content-pipeline/dto/find-all-project.dto';

@ApiTags('Content-Pipeline')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'content-pipeline/projects', version: '1' })
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  findAll(@Query() query: FindAllProjectDto) {
    return this.projectService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCpProjectDto) {
    return this.projectService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCpProjectDto) {
    return this.projectService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.projectService.remove(id);
  }
}
