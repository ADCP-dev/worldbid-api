import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  Matches,
} from 'class-validator';

export class CreateBlogPostDto {
  @ApiProperty({ example: '/blog/my-first-post', type: String })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\/$|^\/?[a-z0-9-]+(\/[a-z0-9-]+)*$/, {
    message: 'Slug must start with / and only lowercase, numbers, hyphens and slashes',
  })
  slug: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  featuredImageId?: string;

  @ApiPropertyOptional({ type: String, description: 'Category UUID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Array of Tag UUIDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  isPublished?: boolean;
}
