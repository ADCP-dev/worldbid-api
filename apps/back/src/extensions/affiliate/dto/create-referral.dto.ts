import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
} from 'class-validator';

export class CreateReferralDto {
  @ApiProperty({ example: 1, type: Number })
  @IsNotEmpty()
  @IsInt()
  partnerId: number;

  @ApiProperty({ example: 42, type: Number })
  @IsNotEmpty()
  @IsInt()
  clientId: number;

  @ApiPropertyOptional({ example: 3, type: Number })
  @IsOptional()
  @IsInt()
  originId?: number;

  @ApiPropertyOptional({ example: 'pending', type: String })
  @IsOptional()
  @IsEnum(['pending', 'converted', 'rejected'])
  status?: string;

  @ApiPropertyOptional({ example: {}, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
