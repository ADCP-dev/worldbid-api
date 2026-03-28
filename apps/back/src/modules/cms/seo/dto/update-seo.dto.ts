import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  IsObject,
  IsEnum,
} from 'class-validator';

export class UpdateSeoDto {
  @ApiPropertyOptional({ example: 'My Page Title', type: String })
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional({ example: 'This is my page description', type: String })
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({ example: ['keyword1', 'keyword2'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metaKeywords?: string[];

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  ogImageId?: string;

  @ApiPropertyOptional({ example: 'https://example.com/page', type: String })
  @IsOptional()
  @IsString()
  canonicalUrl?: string;

  @ApiPropertyOptional({ example: 'My OG Title', type: String })
  @IsOptional()
  @IsString()
  ogTitle?: string;

  @ApiPropertyOptional({ example: 'My OG Description', type: String })
  @IsOptional()
  @IsString()
  ogDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customJsonLd?: Record<string, any>;

  @ApiPropertyOptional({ enum: ['WebPage', 'Article', 'WebSite'] })
  @IsOptional()
  @IsEnum(['WebPage', 'Article', 'WebSite'])
  type?: 'WebPage' | 'Article' | 'WebSite';
}
