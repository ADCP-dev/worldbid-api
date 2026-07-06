import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'Acme Corp', type: String })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Acme Corporation S.L.', type: String })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'B12345678', type: String })
  @IsOptional()
  @IsString()
  nif?: string;

  @ApiPropertyOptional({ example: 'info@acme.com', type: String })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+34 600 000 000', type: String })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Calle Mayor 1', type: String })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Madrid', type: String })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Madrid', type: String })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ example: 'España', type: String })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 1, type: Number })
  @IsOptional()
  @IsInt()
  statusId?: number;

  @ApiPropertyOptional({ example: 2, type: Number })
  @IsOptional()
  @IsInt()
  originId?: number;

  @ApiPropertyOptional({ example: 'Referral from John', type: String })
  @IsOptional()
  @IsString()
  originDetail?: string;

  @ApiPropertyOptional({ example: {}, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
