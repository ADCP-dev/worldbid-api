import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsBoolean,
  Max,
  Min,
} from 'class-validator';

/**
 * Payload for creating an affiliate partner from an existing CRM client.
 * Partner identity fields (name/email/company/phone) are copied from the CRM client.
 */
export class CreatePartnerFromClientDto {
  @ApiProperty({
    description: 'Default commission rate for this partner (0-1, e.g. 0.05 = 5%)',
    example: 0.05,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate: number;

  @ApiPropertyOptional({
    description: 'Send the portal invitation email right away (default: true)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  invite?: boolean;
}