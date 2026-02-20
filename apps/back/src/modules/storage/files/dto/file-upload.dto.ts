import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

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
  entity?: string;

  @ApiProperty({
    type: String,
    description: 'Entity ID (string or UUID)',
    required: false,
  })
  @IsString()
  @IsOptional()
  entityId?: string;
}
