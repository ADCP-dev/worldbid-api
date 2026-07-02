import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray } from 'class-validator';

export class FfmpegJobDto {
  @ApiProperty({ required: false, description: 'Direct URL to the media file' })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiProperty({ example: 'ffmpeg -y -i {input} -c:v libx264 -crf 23 {output}' })
  @IsString()
  fullCommand: string;

  @ApiProperty({ example: 'mp4' })
  @IsString()
  outputExtension: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  filename?: string;
}

export class FfmpegPresetDto {
  @ApiProperty()
  @IsString()
  fileUrl: string;
}

export class FfmpegBurnTextDto {
  @ApiProperty()
  @IsString()
  fileUrl: string;

  @ApiProperty()
  @IsString()
  text: string;

  @ApiProperty({ required: false, default: 48 })
  @IsOptional()
  @IsString()
  fontSize?: string;
}

export class FfmpegConcatDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  fileUrls: string[];
}

export class ScheduleUpdateDto {
  @ApiProperty({ required: false, description: 'ISO 8601 datetime' })
  @IsOptional()
  @IsString()
  scheduledDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  caption?: string;
}

export class AnalyticsQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profileUsername?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];
}

export class WebhookConfigureDto {
  @ApiProperty()
  @IsString()
  webhookUrl: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telegramChatId?: string;

  @ApiProperty({
    required: false,
    description: 'Event filters. Omit to enable all events.',
  })
  @IsOptional()
  events?: {
    uploadCompleted?: boolean;
    socialAccountConnected?: boolean;
    socialAccountDisconnected?: boolean;
    socialAccountReauthRequired?: boolean;
  };
}

export class InstagramCommentReplyDto {
  @ApiProperty()
  @IsString()
  commentId: string;

  @ApiProperty()
  @IsString()
  message: string;
}

export class InstagramDmDto {
  @ApiProperty()
  @IsString()
  username: string;

  @ApiProperty()
  @IsString()
  message: string;
}

export class GoogleBusinessSelectDto {
  @ApiProperty()
  @IsString()
  locationId: string;
}