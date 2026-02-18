---
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/dto/find-all-<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>-paginated.dto.ts
---
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class FindAll<%= h.inflection.transform(name, ['pluralize']) %>PaginatedDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter parameters following JSON API specification',
  })
  @IsOptional()
  @Type(() => Object)
  filter?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  originalUrl?: string;
}
