import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsNumber,
} from 'class-validator';

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

export class WebhookEventsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  uploadCompleted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  socialAccountConnected?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  socialAccountDisconnected?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  socialAccountReauthRequired?: boolean;
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
    type: WebhookEventsDto,
  })
  @IsOptional()
  events?: WebhookEventsDto;
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

const UNIFIED_COMMENT_PLATFORMS = [
  'instagram',
  'facebook',
  'youtube',
  'linkedin',
] as const;

export class UnifiedListCommentsDto {
  @ApiProperty({ description: 'Full post URL (alternative to postId)' })
  @IsOptional()
  @IsString()
  postUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postId?: string;

  @ApiPropertyOptional({ enum: UNIFIED_COMMENT_PLATFORMS })
  @IsOptional()
  @IsIn(UNIFIED_COMMENT_PLATFORMS as unknown as string[])
  platform?: string;

  @ApiPropertyOptional({ description: 'Defaults to configured profile' })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  after?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class UnifiedCreateCommentDto {
  @ApiProperty({ enum: UNIFIED_COMMENT_PLATFORMS })
  @IsIn(UNIFIED_COMMENT_PLATFORMS as unknown as string[])
  platform: string;

  @ApiPropertyOptional({
    description: 'Profile username (defaults to configured profile)',
  })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Reply to this comment id' })
  @IsOptional()
  @IsString()
  commentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postUrl?: string;
}

export class UnifiedDeleteCommentDto {
  @ApiProperty({ enum: UNIFIED_COMMENT_PLATFORMS })
  @IsIn(UNIFIED_COMMENT_PLATFORMS as unknown as string[])
  platform: string;

  @ApiPropertyOptional({
    description: 'Profile username (defaults to configured profile)',
  })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiProperty()
  @IsString()
  commentId: string;

  @ApiPropertyOptional({ description: 'Required for LinkedIn' })
  @IsOptional()
  @IsString()
  postId?: string;
}
