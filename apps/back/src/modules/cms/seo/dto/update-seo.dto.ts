import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  IsObject,
  IsEnum,
  IsBoolean,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RobotsPolicyDto {
  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  index?: boolean;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  follow?: boolean;

  @ApiPropertyOptional({ enum: ['none', 'small', 'large'] })
  @IsOptional()
  @IsString()
  maxImagePreview?: 'none' | 'small' | 'large';

  @ApiPropertyOptional({ enum: ['none', 'small', 'large'] })
  @IsOptional()
  @IsString()
  maxVideoPreview?: 'none' | 'small' | 'large';

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  maxSnippet?: 'none' | number;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  noArchive?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  noTranslate?: boolean;
}

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
  customJsonLd?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['WebPage', 'Article', 'WebSite'] })
  @IsOptional()
  @IsEnum(['WebPage', 'Article', 'WebSite'])
  type?: 'WebPage' | 'Article' | 'WebSite';

  @ApiPropertyOptional({ type: RobotsPolicyDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RobotsPolicyDto)
  robotsPolicy?: RobotsPolicyDto;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  hreflangEnabled?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hreflangAlternateLocales?: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  hreflangCustomUrls?: Record<string, string>;
}
