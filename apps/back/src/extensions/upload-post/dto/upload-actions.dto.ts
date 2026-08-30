import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsNumber } from 'class-validator';

const RETRYABLE_PLATFORMS = [
  'facebook',
  'youtube',
  'x',
  'linkedin',
  'threads',
] as const;

export class RetryUploadDto {
  @ApiProperty({
    required: false,
    description: 'request_id of the original async upload',
  })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiProperty({ required: false, description: 'job_id of the scheduled post' })
  @IsOptional()
  @IsString()
  jobId?: string;
}

export class UnpublishDto {
  @ApiProperty({ enum: RETRYABLE_PLATFORMS })
  @IsIn(RETRYABLE_PLATFORMS as unknown as string[])
  platform: string;

  @ApiProperty({ description: 'Published post ID on the target platform' })
  @IsString()
  postId: string;
}

export class ListCommentsDto {
  @ApiProperty({ description: 'Full post URL (alternative to postId)' })
  @IsOptional()
  @IsString()
  postUrl?: string;

  @ApiPropertyOptional({
    description: 'Profile username (defaults to configured profile)',
  })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiPropertyOptional({
    description: 'platform key (defaults upstream to instagram)',
  })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postId?: string;

  @ApiPropertyOptional({ description: 'Pagination cursor' })
  @IsOptional()
  @IsString()
  after?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class ReplyCommentDto {
  @ApiProperty()
  @IsString()
  commentId: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'platform for the unified API (default instagram)',
  })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postId?: string;
}

export type UnpublishPlatformValue = (typeof RETRYABLE_PLATFORMS)[number];
