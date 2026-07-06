import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class UpdateReferralDto {
  @ApiPropertyOptional({
    example: 'converted',
    type: String,
    description: 'One of: pending, converted, rejected',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsEnum(['pending', 'converted', 'rejected'])
  status?: string;

  @ApiPropertyOptional({ example: {}, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
