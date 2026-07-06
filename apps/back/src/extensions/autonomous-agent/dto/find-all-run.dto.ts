import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class FindAllRunDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by projectId (exact match)' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ enum: ['research', 'generate', 'publish', 'metrics'] })
  @IsOptional()
  @IsIn(['research', 'generate', 'publish', 'metrics'])
  runType?: string;

  @ApiPropertyOptional({ enum: ['pending', 'running', 'completed', 'failed'] })
  @IsOptional()
  @IsIn(['pending', 'running', 'completed', 'failed'])
  status?: string;
}
