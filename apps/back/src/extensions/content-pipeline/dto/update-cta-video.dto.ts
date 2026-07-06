import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class UpdateCtaVideoDto {
  @ApiPropertyOptional({ example: 'Default CTA — Subscribe' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cta/subscribe.mp4' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ example: 'mp4' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  format?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  durationSec?: number;

  @ApiPropertyOptional({
    description:
      'If set to true, this becomes the default CTA (deactivates all others).',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
