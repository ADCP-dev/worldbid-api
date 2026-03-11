import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateBlogCategoryDto {
  @ApiProperty({ example: 'technology', type: String })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiPropertyOptional({ example: 0, type: Number })
  @IsOptional()
  @Min(0)
  order?: number;
}
