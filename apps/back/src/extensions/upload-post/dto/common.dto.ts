import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

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