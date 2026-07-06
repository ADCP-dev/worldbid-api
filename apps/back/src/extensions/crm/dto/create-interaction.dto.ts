import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateInteractionDto {
  @ApiProperty({ example: 1, type: Number })
  @IsNotEmpty()
  @IsInt()
  clientId: number;

  @ApiPropertyOptional({ example: 2, type: Number })
  @IsOptional()
  @IsInt()
  contactId?: number;

  @ApiProperty({
    example: 'meeting',
    enum: ['meeting', 'call', 'email', 'whatsapp', 'note', 'other'],
  })
  @IsNotEmpty()
  @IsEnum(['meeting', 'call', 'email', 'whatsapp', 'note', 'other'])
  type: 'meeting' | 'call' | 'email' | 'whatsapp' | 'note' | 'other';

  @ApiPropertyOptional({ example: 'Initial discovery call', type: String })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    example: 'Discussed needs and timeline.',
    type: String,
  })
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
