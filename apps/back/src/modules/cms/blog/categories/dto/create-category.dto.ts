import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateBlogCategoryDto {
  @ApiProperty({ example: 'technology', type: String })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiProperty({ example: 'Technology', type: String })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Posts about technology', type: String })
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
}
