import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';

export class FileDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  path: string;

  @ApiProperty({ default: true })
  @IsBoolean()
  isPublic: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty()
  @IsNumber()
  size: number;
}
