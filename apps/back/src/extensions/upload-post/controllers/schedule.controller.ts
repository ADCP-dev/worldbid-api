import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ScheduleService } from '@ext/upload-post/services/schedule.service';
import { ScheduleUpdateDto } from '@ext/upload-post/dto/common.dto';

@ApiTags('Upload-Post')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'upload-post/schedule', version: '1' })
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get()
  listScheduled() {
    return this.scheduleService.listScheduled();
  }

  @Patch(':jobId')
  update(@Param('jobId') jobId: string, @Body() dto: ScheduleUpdateDto) {
    return this.scheduleService.update(jobId, dto);
  }

  @Delete(':jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(@Param('jobId') jobId: string) {
    return this.scheduleService.cancel(jobId);
  }
}