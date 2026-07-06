import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateIdeaDto {
  @ApiProperty({ example: '10 easy vegan dinners under 30 minutes' })
  @IsString()
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({ example: 'Time-starved weeknight angle' })
  @IsOptional()
  @IsString()
  angle?: string;

  @ApiPropertyOptional({ type: [String], example: ['vegan', 'quick'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['blog', 'instagram', 'pinterest'],
    description: 'Target platforms: blog, instagram, pinterest, tiktok, ...',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetPlatforms?: string[];

  @ApiPropertyOptional({
    enum: ['recipe', 'comparison', 'tips', 'review', 'listicle', 'guide'],
    default: 'recipe',
  })
  @IsOptional()
  @IsIn(['recipe', 'comparison', 'tips', 'review', 'listicle', 'guide'])
  contentType?: string;

  @ApiPropertyOptional({
    enum: ['manual', 'ai_research', 'trend', 'competitor_analysis'],
    default: 'manual',
  })
  @IsOptional()
  @IsIn(['manual', 'ai_research', 'trend', 'competitor_analysis'])
  source?: string;

  @ApiPropertyOptional({
    description:
      'Research payload: { trendingTopics, searchVolume, difficulty, competitorUrls, relatedKeywords }',
  })
  @IsOptional()
  @IsObject()
  researchData?: Record<string, unknown>;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @ApiPropertyOptional({
    enum: ['idea', 'approved', 'rejected', 'drafting', 'published'],
    default: 'idea',
  })
  @IsOptional()
  @IsIn(['idea', 'approved', 'rejected', 'drafting', 'published'])
  status?: string;
}
