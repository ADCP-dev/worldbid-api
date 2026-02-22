import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTranslationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  section: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  langId: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  app?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  entityName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  entityId?: string;
}
