import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateContactDto {
  @ApiPropertyOptional({ example: 'Jane Doe', type: String })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'CEO', type: String })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: 'jane@acme.com', type: String })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+34 600 000 000', type: String })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ example: {}, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
