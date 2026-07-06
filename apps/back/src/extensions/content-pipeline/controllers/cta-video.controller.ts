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
import { CtaVideoService } from '@ext/content-pipeline/services/cta-video.service';
import { CreateCtaVideoDto } from '@ext/content-pipeline/dto/create-cta-video.dto';
import { UpdateCtaVideoDto } from '@ext/content-pipeline/dto/update-cta-video.dto';

@ApiTags('Content-Pipeline')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'content-pipeline/cta-videos', version: '1' })
export class CtaVideoController {
  constructor(private readonly ctaVideoService: CtaVideoService) {}

  // Static routes must be declared BEFORE any wildcard (:id) route.
  @Get('active')
  findActive() {
    return this.ctaVideoService.findActive();
  }

  @Get()
  findAll() {
    return this.ctaVideoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ctaVideoService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCtaVideoDto) {
    return this.ctaVideoService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCtaVideoDto) {
    return this.ctaVideoService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.ctaVideoService.remove(id);
  }
}
