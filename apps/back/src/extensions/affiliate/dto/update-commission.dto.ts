import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
} from 'class-validator';

export class UpdateCommissionDto {
  @ApiPropertyOptional({
    example: 'paid',
    type: String,
    description: 'One of: pending, approved, paid',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsEnum(['pending', 'approved', 'paid'])
  status?: string;

  @ApiPropertyOptional({ example: {}, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}