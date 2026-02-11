import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class FindAllUserDto {
  @ApiPropertyOptional({
    description: 'Filter parameters following JSON API specification',
  })
  @IsOptional()
  @Type(() => Object)
  filter?: Record<string, any>;
}
