import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsIn,
  MaxLength,
} from 'class-validator';

/**
 * Explicit update DTO — does NOT use PartialType(CreateProjectDto).
 * The `slug` field is intentionally omitted: slugs are immutable after
 * creation (they are used as stable identifiers by downstream CMS/social
 * integrations).
 */
export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Recipe Blog ES — updated' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'recipes' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  niche?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandVoice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @ApiPropertyOptional({ example: 'es' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  authorPersona?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  affiliateConfig?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  socialConfig?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  cmsConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ example: { blog: true, social: false } })
  @IsOptional()
  @IsObject()
  autoPublish?: { blog: boolean; social: boolean };

  @ApiPropertyOptional({ enum: ['active', 'paused', 'archived'] })
  @IsOptional()
  @IsIn(['active', 'paused', 'archived'])
  status?: string;

  @ApiPropertyOptional({
    description:
      'Brand design system document (DESIGN.md content) injected into LLM prompts.',
  })
  @IsOptional()
  @IsString()
  designDoc?: string;
}