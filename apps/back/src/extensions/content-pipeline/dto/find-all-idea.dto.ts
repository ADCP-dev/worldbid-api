import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class FindAllIdeaDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({
    enum: ['idea', 'approved', 'generating', 'generated', 'rejected'],
    description: 'Filter by status (kanban column)',
  })
  @IsOptional()
  @IsIn(['idea', 'approved', 'generating', 'generated', 'rejected'])
  status?: string;

  @ApiPropertyOptional({ description: 'Case-insensitive search over title' })
  @IsOptional()
  @IsString()
  search?: string;
}
