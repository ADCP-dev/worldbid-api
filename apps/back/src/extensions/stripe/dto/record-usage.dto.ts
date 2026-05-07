import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class RecordUsageDto {
  @ApiProperty({ example: 100, type: Number })
  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional({ enum: ['set', 'increment'], default: 'set' })
  @IsOptional()
  @IsEnum(['set', 'increment'])
  action?: 'set' | 'increment';

  @ApiPropertyOptional({ example: new Date(), type: Date })
  @IsOptional()
  timestamp?: Date;
}
