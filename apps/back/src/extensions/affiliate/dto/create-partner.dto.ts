import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePartnerDto {
  @ApiProperty({ example: 'John Doe', type: String })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Acme Corp', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiProperty({ example: 'john@acme.com', type: String })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ example: '+34 600 000 000', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'ES00 0000 0000 0000 0000', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  iban?: string;

  @ApiPropertyOptional({ example: 0.05, type: Number })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: {}, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
