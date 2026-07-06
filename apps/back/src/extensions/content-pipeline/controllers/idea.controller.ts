import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { IdeaService } from '@ext/content-pipeline/services/idea.service';
import { ProjectService } from '@ext/content-pipeline/services/project.service';
import { TrendResearchService } from '@ext/content-pipeline/services/trend-research.service';
import { ContentGeneratorService } from '@ext/content-pipeline/services/content-generator.service';
import { CreateIdeaDto } from '@ext/content-pipeline/dto/create-idea.dto';
import { UpdateIdeaDto } from '@ext/content-pipeline/dto/update-idea.dto';
import { FindAllIdeaDto } from '@ext/content-pipeline/dto/find-all-idea.dto';
import { UpdateIdeaStatusDto } from '@ext/content-pipeline/dto/update-idea-status.dto';
import { ReorderIdeasDto } from '@ext/content-pipeline/dto/reorder-ideas.dto';

@ApiTags('Content-Pipeline')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'content-pipeline', version: '1' })
export class IdeaController {
  constructor(
    private readonly ideaService: IdeaService,
    private readonly projectService: ProjectService,
    private readonly trendResearchService: TrendResearchService,
    private readonly contentGeneratorService: ContentGeneratorService,
  ) {}

  // ─── Ideas scoped to a project ────────────────────────────────────
  @Get('projects/:projectId/ideas')
  findAllByProject(
    @Param('projectId') projectId: string,
    @Query() query: FindAllIdeaDto,
  ) {
    return this.ideaService.findAllByProject(projectId, query);
  }

  @Post('projects/:projectId/ideas')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateIdeaDto,
  ) {
    return this.ideaService.create(projectId, dto);
  }

  /**
   * Trigger trend research for a project via Tavily. Returns generated
   * idea candidates (NOT persisted — the client picks which to save).
   */
  @Post('projects/:projectId/ideas/research')
  @HttpCode(HttpStatus.OK)
  async research(@Param('projectId') projectId: string) {
    const project = await this.projectService.findById(projectId);
    return this.trendResearchService.research(project);
  }

  // ─── Ideas by id (cross-project) ──────────────────────────────────
  @Get('ideas/:id')
  findById(@Param('id') id: string) {
    return this.ideaService.findById(id);
  }

  @Patch('ideas/:id')
  update(@Param('id') id: string, @Body() dto: UpdateIdeaDto) {
    return this.ideaService.update(id, dto);
  }

  @Patch('ideas/:id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateIdeaStatusDto,
  ) {
    return this.ideaService.updateStatus(id, dto.status, dto.order);
  }

  /**
   * Generate a draft for an idea via the content generator (Ollama Cloud).
   * Returns the generated draft (blog content + social variants).
   */
  @Post('ideas/:id/generate')
  @HttpCode(HttpStatus.OK)
  async generate(@Param('id') id: string) {
    const idea = await this.ideaService.findById(id);
    const project = await this.projectService.findById(idea.projectId);
    return this.contentGeneratorService.generate(project, idea);
  }

  @Post('ideas/reorder')
  @HttpCode(HttpStatus.OK)
  reorder(@Body() dto: ReorderIdeasDto) {
    return this.ideaService.reorder(dto.orderedIds);
  }

  @Delete('ideas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.ideaService.remove(id);
  }
}