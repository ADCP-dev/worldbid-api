import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** Optional inline client creation payload for admin referral registration. */
export class NewClientDto {
  @ApiProperty({ example: 'Acme Corp', type: String })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'billing@acme.com', type: String })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(200)
  email: string;

  @ApiPropertyOptional({ example: 'Acme S.L.', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional({ example: '+34 600 000 000', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}

export class CreateReferralDto {
  @ApiProperty({ example: 1, type: Number })
  @IsNotEmpty()
  @IsInt()
  partnerId: number;

  @ApiPropertyOptional({
    description: 'Existing CRM client to refer (either this or newClient)',
    example: 42,
    type: Number,
  })
  @IsOptional()
  @IsInt()
  clientId?: number;

  @ApiPropertyOptional({
    description: 'Create the CRM client inline and refer it (either this or clientId)',
    type: NewClientDto,
  })
  @IsOptional()
  @ValidateIf((o) => !o.clientId)
  @IsNotEmpty()
  newClient?: NewClientDto;

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