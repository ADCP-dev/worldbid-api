import { IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNoteDto {
  @ApiProperty({ type: String, maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ type: String })
  @IsString()
  contentMd: string;

  @ApiPropertyOptional({ type: String, description: 'ltree path, e.g. "tech.notes.async"' })
  @IsOptional()
  @IsString()
  categoryPath?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: Object, description: 'OKF frontmatter metadata' })
  @IsOptional()
  @IsObject()
  frontmatter?: Record<string, unknown>;
}