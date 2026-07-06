import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsUuid,
  MaxLength,
} from 'class-validator';

export class CreateConfigDto {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  @IsUuid()
  projectId: string;

  @ApiPropertyOptional({ example: '0 9 * * *', default: '0 9 * * *' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  researchCron?: string;

  @ApiPropertyOptional({ example: '0 10 * * *', default: '0 10 * * *' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  generateCron?: string;

  @ApiPropertyOptional({ example: '0 18 * * *', default: '0 18 * * *' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  publishCron?: string;

  @ApiPropertyOptional({ example: '0 9 * * 1', default: '0 9 * * 1' })
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

  @ApiPropertyOptional({ enum: ['active', 'paused'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'paused', 'archived'])
  status?: string;
}