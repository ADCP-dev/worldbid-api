import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateOriginDto {
  @ApiProperty({ example: 'networking', type: String })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Networking', type: String })
  @IsNotEmpty()
  @IsString()
  label: string;

  @ApiPropertyOptional({ example: 'standard', type: String })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0, type: Number })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: {}, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
