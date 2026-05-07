import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePriceDto {
  @ApiProperty({ example: 'uuid-product-id', type: String })
  @IsNotEmpty()
  @IsString()
  productId: string;

  @ApiPropertyOptional({ example: 'eur', type: String })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 9900, type: Number })
  @IsNotEmpty()
  @IsNumber()
  unitAmount: number;

  @ApiPropertyOptional({
    enum: ['one_time', 'recurring'],
    default: 'recurring',
  })
  @IsOptional()
  @IsEnum(['one_time', 'recurring'])
  type?: 'one_time' | 'recurring';

  @ApiPropertyOptional({ enum: ['month', 'year'] })
  @IsOptional()
  @IsEnum(['month', 'year'])
  interval?: 'month' | 'year';

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
