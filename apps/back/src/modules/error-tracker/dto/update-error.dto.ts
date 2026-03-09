import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateErrorDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  resolved?: boolean;
}
