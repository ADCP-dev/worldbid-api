import { IsOptional, IsString, IsIn, IsArray } from 'class-validator';

export class GenerateCarouselVideoDto {
  @IsOptional()
  @IsIn(['portrait', 'vertical'])
  format?: 'portrait' | 'vertical';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  transitions?: string[];
}