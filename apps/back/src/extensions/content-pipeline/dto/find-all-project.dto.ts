import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class FindAllProjectDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Case-insensitive search over name and slug',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['active', 'paused', 'archived'] })
  @IsOptional()
  @IsIn(['active', 'paused', 'archived'])
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by niche (exact match)' })
  @IsOptional()
  @IsString()
  niche?: string;
}
