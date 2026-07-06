import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  MaxLength,
} from 'class-validator';

/**
 * Explicit update DTO — does NOT use PartialType(CreateConfigDto).
 * `projectId` is intentionally omitted: it is immutable after creation
 * because it uniquely identifies the per-project config.
 *
 * `feedbackData` is intentionally omitted: it is system-managed by
 * FeedbackService only and must not be admin-writable.
 */
export class UpdateConfigDto {
  @ApiPropertyOptional({ example: '0 9 * * *' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  researchCron?: string;

  @ApiPropertyOptional({ example: '0 10 * * *' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  generateCron?: string;

  @ApiPropertyOptional({ example: '0 18 * * *' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  publishCron?: string;

  @ApiPropertyOptional({ example: '0 9 * * 1' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  metricsCron?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  autoApproveIdeas?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  autoApproveDrafts?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  notifyTelegram?: boolean;

  @ApiPropertyOptional({ example: '-1001234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  telegramChatId?: string;

  @ApiPropertyOptional({ enum: ['active', 'paused', 'archived'] })
  @IsOptional()
  @IsIn(['active', 'paused', 'archived'])
  status?: string;
}