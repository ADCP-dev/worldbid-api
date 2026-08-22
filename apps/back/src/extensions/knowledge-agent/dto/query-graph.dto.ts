import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryGraphDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Filter by category_path prefix (ltree)',
  })
  @IsOptional()
  @IsString()
  categoryPath?: string;

  @ApiPropertyOptional({ type: String, description: 'Filter by tag (exact match)' })
  @IsOptional()
  @IsString()
  tag?: string;
}