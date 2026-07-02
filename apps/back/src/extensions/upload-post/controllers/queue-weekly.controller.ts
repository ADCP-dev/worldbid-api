import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { QueueService } from '@ext/upload-post/services/queue.service';
import { WeeklyReportService } from '@ext/upload-post/services/weekly-report.service';

@ApiTags('Upload-Post')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'upload-post/queue', version: '1' })
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('preview')
  preview() {
    return this.queueService.preview();
  }

  @Get('next-slot')
  nextSlot() {
    return this.queueService.nextSlot();
  }

  @Get('settings')
  getSettings() {
    return this.queueService.getSettings();
  }

  @Post('settings')
  updateSettings(@Body() settings: Record<string, any>) {
    return this.queueService.updateSettings(settings);
  }
}

@ApiTags('Upload-Post')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'upload-post/weekly-report', version: '1' })
export class WeeklyReportController {
  constructor(private readonly reportService: WeeklyReportService) {}

  @Get()
  generate() {
    return this.reportService.generate();
  }

  @Post('send')
  sendReport() {
    return this.reportService.sendReport();
  }
}