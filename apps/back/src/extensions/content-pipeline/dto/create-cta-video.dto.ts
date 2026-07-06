import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCtaVideoDto {
  @ApiProperty({ example: 'Default CTA — Subscribe' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    example: 'https://cdn.example.com/cta/subscribe.mp4',
    description: 'S3 presigned URL or public CDN URL to the CTA MP4 clip.',
  })
  @IsString()
  url: string;

  @ApiPropertyOptional({ example: 'mp4', default: 'mp4' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  format?: string;

  @ApiPropertyOptional({ example: 5, description: 'Duration in seconds.' })
  @IsOptional()
  @IsInt()
  durationSec?: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'If true, this becomes the default CTA (deactivates all others).',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'Pre-roll subscribe CTA for all templates.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}