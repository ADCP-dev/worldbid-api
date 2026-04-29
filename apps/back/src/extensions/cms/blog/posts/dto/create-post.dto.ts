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
  @ApiProperty({ example: 'my-first-post', type: String })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Must be kebab-case' })
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
