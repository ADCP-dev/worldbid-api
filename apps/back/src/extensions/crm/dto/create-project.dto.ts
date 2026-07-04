import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 1, type: Number })
  @IsNotEmpty()
  @IsInt()
  clientId: number;

  @ApiProperty({ example: 'Website Redesign', type: String })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'pack_1',
    enum: ['pack_1', 'pack_2', 'pack_3', 'pack_4', 'custom'],
  })
  @IsOptional()
  @IsString()
  type?: 'pack_1' | 'pack_2' | 'pack_3' | 'pack_4' | 'custom';

  @ApiPropertyOptional({ example: 1500.0, type: Number })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: 'quoted', type: String })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'pending', type: String })
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @ApiPropertyOptional({ example: '2025-02-01', type: String })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-04-01', type: String })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: {}, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}