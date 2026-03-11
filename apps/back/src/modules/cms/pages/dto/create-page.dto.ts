import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  IsArray,
} from 'class-validator';
import { PageTemplate } from '../infrastructure/entities/page.entity';

export class CreatePageDto {
  @ApiProperty({ example: 'home', type: String })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiPropertyOptional({ example: '/es/home', type: String })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional({ enum: PageTemplate, default: PageTemplate.GENERIC })
  @IsOptional()
  @IsEnum(PageTemplate)
  template?: PageTemplate;

  @ApiPropertyOptional({ example: 0, type: Number })
  @IsOptional()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  featuredImageId?: string;
}
