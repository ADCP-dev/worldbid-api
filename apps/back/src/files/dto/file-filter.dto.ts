import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateIf, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class FileFilterDto {
  @ApiProperty({
    required: false,
    description: 'Entity type to filter by',
    example: 'user',
  })
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiProperty({
    required: false,
    description: 'Entity ID to filter by (requires entity parameter)',
    example: 'c7f7992f-7d1b-4d93-8f1b-9c2b8b9a6b13',
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.entity !== undefined)
  entityId?: string;

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
}
