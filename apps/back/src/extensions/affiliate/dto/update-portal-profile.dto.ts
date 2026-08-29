import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO for affiliate self-service profile update.
 * Only phone, iban and companyName are editable by the partner themselves.
 * Identity fields (name, email, code) are admin-managed.
 */
export class UpdatePortalProfileDto {
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

  @ApiPropertyOptional({ example: 'Acme S.L.', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;
}