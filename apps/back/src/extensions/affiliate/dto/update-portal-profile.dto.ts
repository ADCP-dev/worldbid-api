import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO for affiliate self-service profile update.
 * Only name, phone, iban are editable by the partner themselves.
 */
export class UpdatePortalProfileDto {
  @ApiPropertyOptional({ example: 'John Doe', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

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
}