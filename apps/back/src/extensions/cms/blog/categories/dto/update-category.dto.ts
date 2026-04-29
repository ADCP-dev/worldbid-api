import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'technology', type: String })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slug?: string;

  @ApiPropertyOptional({ example: 'Technology', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Category description', type: String })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 0, type: Number })
  @IsOptional()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ example: 'uuid', type: String })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ example: ['uuid1', 'uuid2'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];
}
