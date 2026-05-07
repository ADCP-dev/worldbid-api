import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  ValidateIf,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsEntityTable } from '@infra/utils/validators/is-entity-table.validator';

export class FileFilterDto {
  @ApiProperty({
    required: false,
    description: 'Entity type to filter by',
    example: 'user',
  })
  @IsOptional()
  @IsString()
  @IsEntityTable()
  entityName?: string;

  @ApiProperty({
    required: false,
    description: 'Entity ID to filter by (requires entityName parameter)',
    example: 'c7f7992f-7d1b-4d93-8f1b-9c2b8b9a6b13',
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.entityName !== undefined)
  entityId?: string;

  @ApiProperty({
    required: false,
    description: 'Context or category to filter by',
    example: 'blog-post',
  })
  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  userId?: number;

  @ApiProperty({
    required: false,
    description: 'MIME type to filter by',
    example: 'image/jpeg',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({
    required: false,
    description: 'Page number for pagination',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiProperty({
    required: false,
    description: 'Number of items per page',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
