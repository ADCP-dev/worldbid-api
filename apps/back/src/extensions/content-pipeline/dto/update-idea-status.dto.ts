import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsInt } from 'class-validator';

export class UpdateIdeaStatusDto {
  @ApiProperty({
    enum: ['idea', 'approved', 'generating', 'generated', 'rejected'],
    description: 'New kanban status for the idea',
  })
  @IsEnum(['idea', 'approved', 'generating', 'generated', 'rejected'])
  status: string;

  @ApiPropertyOptional({
    type: Number,
    description: 'Optional explicit sort order within the new column',
  })
  @IsOptional()
  @IsInt()
  order?: number;
}