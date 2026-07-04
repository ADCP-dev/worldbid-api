import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class PortalCreateReferralDto {
  @ApiProperty({ example: 'Jane Smith', type: String })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  client_name: string;

  @ApiPropertyOptional({ example: 'Smith Ltd', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company_name?: string;

  @ApiProperty({ example: 'jane@smith.com', type: String })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ example: '+34 600 000 000', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({
    example: 'Met at conference, interested in pack 2',
    type: String,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: {}, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}