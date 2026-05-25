import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'uuid-plan-id', type: String })
  @IsNotEmpty()
  @IsString()
  planId: string;

  @ApiPropertyOptional({ example: 'incomplete', type: String })
  @IsOptional()
  @IsString()
  status?: string;
}
