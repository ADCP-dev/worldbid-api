---
to: src/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/dto/update-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
---
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsBoolean, IsDate, IsUUID, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';
/* eslint-enable @typescript-eslint/no-unused-vars */

export class Update<%= name %>Dto {
  // <update-properties />
}
