import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'Pro Plan', type: String })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Best for teams', type: String })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'uuid-price-id', type: String })
  @IsNotEmpty()
  @IsString()
  priceId: string;

  @ApiPropertyOptional({ example: 10, type: Number })
  @IsOptional()
  @IsNumber()
  maxUsers?: number;

  @ApiPropertyOptional({ example: 10737418240, type: Number })
  @IsOptional()
  @IsNumber()
  maxStorage?: number;

  @ApiPropertyOptional({ example: ['feature-1', 'feature-2'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ example: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
