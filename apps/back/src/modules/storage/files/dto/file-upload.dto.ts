import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsEntityTable } from '@infra/utils/validators/is-entity-table.validator';

export class FileUploadDto {
  @ApiProperty({
    type: Boolean,
    description:
      'Whether the file should be publicly accessible (true) or private (false)',
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isPublic?: boolean = true;

  @ApiProperty({
    type: String,
    description: 'Entity name',
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsEntityTable()
  entityName?: string;

  @ApiProperty({
    type: String,
    description: 'Entity ID (string or UUID)',
    required: false,
  })
  @IsString()
  @IsOptional()
  entityId?: string;

  @ApiProperty({
    type: String,
    description: 'Context or category for the file',
    required: false,
  })
  @IsString()
  @IsOptional()
  context?: string;
}
