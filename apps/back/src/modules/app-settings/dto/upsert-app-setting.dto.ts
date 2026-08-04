import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertAppSettingDto {
  @ApiProperty({
    type: Object,
    description: 'jsonb value. For ordering keys: Record<id, number>',
  })
  @IsObject()
  value: Record<string, unknown>;

  @ApiPropertyOptional({
    type: String,
    description: 'Grouping tag, e.g. "ordering"',
  })
  @IsOptional()
  @IsString()
  section?: string;
}
