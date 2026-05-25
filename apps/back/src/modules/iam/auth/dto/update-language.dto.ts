import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn } from 'class-validator';

export class UpdateLanguageDto {
  @ApiProperty({ example: 'es', description: 'ISO 639-1 language code' })
  @IsString()
  @IsIn(['en', 'es'])
  language: string;
}
