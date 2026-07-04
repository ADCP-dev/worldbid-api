import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateReferralDto {
  @ApiPropertyOptional({
    example: 'converted',
    type: String,
    description: 'One of: pending, converted, rejected',
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