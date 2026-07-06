import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsIn,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

/**
 * Explicit update DTO — does NOT use PartialType(CreateIdeaDto).
 * `projectId` is intentionally omitted: ideas are scoped to their project
 * for life. Use `source` only via create or admin migration flows.
 */
export class UpdateIdeaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  angle?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetPlatforms?: string[];

  @ApiPropertyOptional({
    enum: ['recipe', 'comparison', 'tips', 'review', 'listicle', 'guide'],
  })
  @IsOptional()
  @IsIn(['recipe', 'comparison', 'tips', 'review', 'listicle', 'guide'])
  contentType?: string;

  @ApiPropertyOptional({
    enum: ['idea', 'approved', 'generating', 'generated', 'rejected'],
    description: 'Kanban column / lifecycle status',
  })
  @IsOptional()
  @IsIn(['idea', 'approved', 'generating', 'generated', 'rejected'])
  status?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Kanban sort order' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  researchData?: Record<string, unknown>;
}
