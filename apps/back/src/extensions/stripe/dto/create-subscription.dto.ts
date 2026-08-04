import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'uuid-plan-id', type: String })
  @IsNotEmpty()
  @IsString()
  planId: string;

  @ApiPropertyOptional({
    example: 'incomplete',
    enum: ['active', 'past_due', 'canceled', 'incomplete', 'trialing'],
  })
  @IsOptional()
  @IsEnum(['active', 'past_due', 'canceled', 'incomplete', 'trialing'])
  status?: string;
}
