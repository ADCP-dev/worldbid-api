import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateBlogCategoryDto {
  @ApiPropertyOptional({ example: 'technology', type: String })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({ example: 'Technology', type: String })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

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
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: ['uuid1', 'uuid2'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];
}
