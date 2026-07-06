import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsIn,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCpProjectDto {
  @ApiProperty({ example: 'Recipe Blog ES' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'recipe-blog-es' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  slug: string;

  @ApiProperty({ example: 'recipes' })
  @IsString()
  @MaxLength(100)
  niche: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['recetas', 'cocina'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({ example: 'Friendly, practical, beginner-first' })
  @IsOptional()
  @IsString()
  brandVoice?: string;

  @ApiPropertyOptional({ example: 'Home cooks 25-45, Spain' })
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @ApiPropertyOptional({ example: 'es', default: 'es' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({
    description: 'AI persona config: { name, bio, avatarUrl, credentials }',
    example: { name: 'Chef Lucía', bio: 'Pastry chef' },
  })
  @IsOptional()
  @IsObject()
  authorPersona?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Affiliate config: { enabled, programs, autoInject, disclosureText }',
  })
  @IsOptional()
  @IsObject()
  affiliateConfig?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Social config: { platforms, profileUsername, postingSchedule }',
  })
  @IsOptional()
  @IsObject()
  socialConfig?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'CMS config: { enabled, autoPublish, categoryId, authorUserId }',
  })
  @IsOptional()
  @IsObject()
  cmsConfig?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Auto-publish gates',
    example: { blog: false, social: false },
    default: { blog: false, social: false },
  })
  @IsOptional()
  @IsObject()
  autoPublish?: { blog: boolean; social: boolean };

  @ApiPropertyOptional({
    enum: ['active', 'paused', 'archived'],
    default: 'active',
  })
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
