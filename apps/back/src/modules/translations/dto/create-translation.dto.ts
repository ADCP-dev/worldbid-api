import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class CreateTranslationDto {
  @ApiProperty({
    required: false,
    description:
      'Section/namespace for the translation. Optional for dynamic translations (when entityName/entityId are provided).',
  })
  @ValidateIf((o) => !o.entityName || !o.entityId)
  @IsString()
  @IsNotEmpty()
  section?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    required: false,
    description:
      'Language code (e.g., "es", "en"). Use this instead of langId for easier usage.',
  })
  @IsString()
  @IsOptional()
  langCode?: string;

  @ApiProperty({
    required: false,
    description:
      'Language ID (number). Use langCode instead for better compatibility.',
  })
  @IsNumber()
  @IsOptional()
  langId?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  app?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  entityName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  entityId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  category?: string;
}
