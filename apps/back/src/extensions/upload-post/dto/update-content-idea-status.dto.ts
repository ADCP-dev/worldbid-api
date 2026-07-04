import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
} from 'class-validator';

export class UpdateContentIdeaStatusDto {
  @ApiProperty({
    enum: ['idea', 'drafting', 'ready', 'scheduled', 'published'],
    description: 'New status for the content idea',
  })
  @IsEnum(['idea', 'drafting', 'ready', 'scheduled', 'published'])
  status: string;

  @ApiPropertyOptional({ type: Number, description: 'Sort order' })
  @IsOptional()
  @IsInt()
  order?: number;
}