import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateStatusDto {
  @ApiProperty({ example: 'lead', type: String })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Lead', type: String })
  @IsNotEmpty()
  @IsString()
  label: string;

  @ApiPropertyOptional({ example: '#6c8cff', type: String })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 0, type: Number })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}