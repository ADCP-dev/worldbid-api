import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FfmpegService } from '@ext/upload-post/services/ffmpeg.service';
import { WebhooksService } from '@ext/upload-post/services/webhooks.service';
import {
  FfmpegJobDto,
  FfmpegPresetDto,
  FfmpegBurnTextDto,
  FfmpegConcatDto,
  WebhookConfigureDto,
} from '@ext/upload-post/dto/common.dto';

@ApiTags('Upload-Post')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'upload-post/ffmpeg', version: '1' })
export class FfmpegController {
  constructor(private readonly ffmpegService: FfmpegService) {}

  @Post('job')
  @HttpCode(HttpStatus.ACCEPTED)
  createJob(@Body() dto: FfmpegJobDto) {
    return this.ffmpegService.createJob(dto);
  }

  @Get('job/:jobId')
  getJobStatus(@Param('jobId') jobId: string) {
    return this.ffmpegService.getJobStatus(jobId);
  }

  @Get('usage')
  getUsage() {
    return this.ffmpegService.getUsage();
  }

  @Post('preset/social-mp4')
  @HttpCode(HttpStatus.ACCEPTED)
  convertToSocialMp4(@Body() dto: FfmpegPresetDto) {
    return this.ffmpegService.convertToSocialMp4(dto.fileUrl);
  }

  @Post('preset/extract-audio')
  @HttpCode(HttpStatus.ACCEPTED)
  extractAudio(@Body() dto: FfmpegPresetDto) {
    return this.ffmpegService.extractAudio(dto.fileUrl);
  }

  @Post('preset/crop-vertical')
  @HttpCode(HttpStatus.ACCEPTED)
  cropVertical(@Body() dto: FfmpegPresetDto) {
    return this.ffmpegService.cropVertical(dto.fileUrl);
  }

  @Post('preset/burn-text')
  @HttpCode(HttpStatus.ACCEPTED)
  burnText(@Body() dto: FfmpegBurnTextDto) {
    return this.ffmpegService.burnText(dto.fileUrl, dto.text, Number(dto.fontSize) || 48);
  }

  @Post('preset/concat')
  @HttpCode(HttpStatus.ACCEPTED)
  concat(@Body() dto: FfmpegConcatDto) {
    if (dto.fileUrls.length >= 2) {
      return this.ffmpegService.concatVideos(dto.fileUrls[0], dto.fileUrls[1]);
    }
    return { error: 'At least 2 URLs required' };
  }
}

@ApiTags('Upload-Post')
@Controller({ path: 'upload-post/webhooks', version: '1' })
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('configure')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  configure(@Body() dto: WebhookConfigureDto) {
    return this.webhooksService.configure({
      webhookUrl: dto.webhookUrl,
      telegramChatId: dto.telegramChatId,
      events: dto.events,
    });
  }

  /**
   * Inbound webhook from Upload-Post. No auth guard — verify with signature in production.
   */
  @Post('incoming')
  @HttpCode(HttpStatus.OK)
  handleIncoming(@Body() payload: any) {
    return this.webhooksService.handleWebhookEvent(payload);
  }
}