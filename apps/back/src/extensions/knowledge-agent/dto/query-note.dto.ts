import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryNoteDto {
  @ApiPropertyOptional({ type: String, description: 'ltree prefix, e.g. "tech" matches "tech.*"' })
  @IsOptional()
  @IsString()
  categoryPath?: string;

  @ApiPropertyOptional({ type: Number, description: 'Tree search depth (0 = exact match)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  depth?: number;

  @ApiPropertyOptional({ type: String, description: 'Full-text search in title and content_md' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  tags?: string[];
}