import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class ReorderCpIdeasDto {
  @ApiProperty({
    type: [String],
    description: 'Ordered array of idea IDs (new order = index + 1)',
  })
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}
