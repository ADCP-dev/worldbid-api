import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import {
  VideoTemplateService,
} from '@ext/content-pipeline/services/video-template.service';
import type { TemplateType } from '@ext/content-pipeline/services/video-template.service';
import { VideoQueueService } from '@ext/content-pipeline/services/video-queue.service';
import { GenerateFromTemplateDto } from '@ext/content-pipeline/dto/generate-from-template.dto';

@ApiTags('Content-Pipeline')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'content-pipeline/templates', version: '1' })
export class TemplateController {
  constructor(
    private readonly videoTemplateService: VideoTemplateService,
    private readonly videoQueueService: VideoQueueService,
  ) {}

  @Get()
  listTemplates() {
    return this.videoTemplateService.listTemplates();
  }

  @Get(':type')
  getTemplate(@Param('type') type: string) {
    if (!this.videoTemplateService.isValidTemplateType(type)) {
      throw new BadRequestException(`Unknown template type: ${type}`);
    }
    try {
      return this.videoTemplateService.getTemplate(type as TemplateType);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new NotFoundException(msg);
    }
  }

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  generateFromTemplate(@Body() dto: GenerateFromTemplateDto) {
    const slots: Record<number, { imageUrl?: string; slide?: Record<string, unknown> }> = {};
    if (dto.slots) {
      for (const [key, val] of Object.entries(dto.slots)) {
        const pos = Number(key);
        if (Number.isNaN(pos) || !val) continue;
        slots[pos] = {
          imageUrl: val.imageUrl,
          slide: val.slide,
        };
      }
    }
    return this.videoQueueService.enqueueGenerateTemplate({
      templateType: dto.template,
      slots,
      options: {
        format: dto.format,
        transitions: dto.transitions,
        ctaVideoUrl: dto.ctaVideoUrl,
        slideDurationSec: dto.slideDurationSec,
      },
    });
  }
}