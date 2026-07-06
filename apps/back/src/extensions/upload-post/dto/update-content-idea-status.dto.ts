import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt } from 'class-validator';

export class UpdateContentIdeaStatusDto {
  @ApiProperty({
    enum: ['idea', 'drafting', 'ready', 'scheduled', 'published'],
    description: 'New status for the content idea',
  })
  @IsEnum(['idea', 'drafting', 'ready', 'scheduled', 'published'])
  status: 'idea' | 'drafting' | 'ready' | 'scheduled' | 'published';

  @ApiPropertyOptional({ type: Number, description: 'Sort order' })
  @IsOptional()
  @IsInt()
  order?: number;
}
