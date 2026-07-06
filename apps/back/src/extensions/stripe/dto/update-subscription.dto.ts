import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ example: 'active', enum: ['active', 'past_due', 'canceled', 'incomplete', 'trialing'] })
  @IsOptional()
  @IsEnum(['active', 'past_due', 'canceled', 'incomplete', 'trialing'])
  status?: string;

  @ApiPropertyOptional({ example: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;
}
