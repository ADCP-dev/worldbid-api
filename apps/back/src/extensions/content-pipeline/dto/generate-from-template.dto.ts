import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  IsNumber,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SlotFillDto {
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsObject()
  slide?: Record<string, unknown>;
}

export class GenerateFromTemplateDto {
  @IsString()
  @IsIn([
    'before-after',
    'product-showcase',
    'presentation',
    'tutorial',
    'case-study',
    'custom',
  ])
  template!: string;

  @IsOptional()
  @IsString()
  ctaVideoPath?: string;

  @IsOptional()
  @IsIn(['portrait', 'vertical'])
  format?: 'portrait' | 'vertical';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  transitions?: string[];

  @IsOptional()
  @IsNumber()
  slideDurationSec?: number;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => SlotFillDto)
  slots?: Record<number, SlotFillDto>;
}