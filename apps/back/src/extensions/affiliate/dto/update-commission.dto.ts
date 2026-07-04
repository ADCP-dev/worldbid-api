import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateCommissionDto {
  @ApiPropertyOptional({
    example: 'paid',
    type: String,
    description: 'One of: pending, approved, paid',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: {}, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}