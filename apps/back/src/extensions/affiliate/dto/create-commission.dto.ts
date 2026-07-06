import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
} from 'class-validator';

export class CreateCommissionDto {
  @ApiProperty({ example: 1, type: Number })
  @IsNotEmpty()
  @IsInt()
  referralId: number;

  @ApiProperty({ example: 7, type: Number })
  @IsNotEmpty()
  @IsInt()
  projectId: number;

  @ApiPropertyOptional({ example: 'pending', type: String })
  @IsOptional()
  @IsEnum(['pending', 'approved', 'paid'])
  status?: string;

  @ApiPropertyOptional({ example: {}, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
