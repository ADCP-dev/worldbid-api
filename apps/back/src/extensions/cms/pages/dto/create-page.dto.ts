import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { PageSection } from '../infrastructure/entities/page.entity';

export class CreatePageDto {
  @ApiProperty({ example: 'about-us', type: String })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-zA-Z0-9]+$/, { message: 'Only letters and numbers, no spaces' })
  name: string;

  @ApiPropertyOptional({ example: '/about/team', type: String })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @Matches(/^\/$|^\/?[a-z0-9-]+(\/[a-z0-9-]+)*$/, {
    message: 'Slug must start with / and only lowercase, numbers, hyphens and slashes',
  })
  slug?: string;

  @ApiPropertyOptional({ example: '/es/home', type: String })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional({ enum: PageSection, default: PageSection.BLOG })
  @IsOptional()
  @IsEnum(PageSection)
  section?: PageSection;

  @ApiPropertyOptional({ example: 0, type: Number })
  @IsOptional()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  featuredImageId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
