import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, ValidateIf } from 'class-validator';
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
    example: 123,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ValidateIf((o) => o.entity !== undefined)
  entityId?: number;

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
