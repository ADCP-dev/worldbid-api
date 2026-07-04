import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateInteractionDto {
  @ApiPropertyOptional({ example: 2, type: Number })
  @IsOptional()
  @IsInt()
  contactId?: number;

  @ApiPropertyOptional({
    example: 'meeting',
    enum: ['meeting', 'call', 'email', 'whatsapp', 'note', 'other'],
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'Initial discovery call', type: String })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ example: 'Discussed needs and timeline.', type: String })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ example: '2025-01-15T10:00:00Z', type: String })
  @IsOptional()
  @IsDateString()
  interactionDate?: string;

  @ApiPropertyOptional({ example: {}, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}