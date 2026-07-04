import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateQueueSettingsDto {
  @ApiPropertyOptional({ description: 'Days to publish (comma-separated: mon,wed,fri)' })
  @IsOptional()
  @IsString()
  publishDays?: string;

  @ApiPropertyOptional({ description: 'Publish time slot (HH:mm)' })
  @IsOptional()
  @IsString()
  publishTime?: string;

  @ApiPropertyOptional({ description: 'Max posts per week' })
  @IsOptional()
  @IsString()
  maxPerWeek?: string;

  @ApiPropertyOptional({ description: 'Auto-skip weekends' })
  @IsOptional()
  @IsBoolean()
  skipWeekends?: boolean;

  @ApiPropertyOptional({ description: 'Timezone for scheduling' })
  @IsOptional()
  @IsString()
  timezone?: string;
}