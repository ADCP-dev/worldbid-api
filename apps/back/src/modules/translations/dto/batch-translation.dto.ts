import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class BatchTranslationPayloadItemDto {
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
  value: string;
}

export class BatchTranslationDto {
  @ApiProperty({ required: false })
  @ValidateIf((o) => !o.category)
  @IsString()
  @IsNotEmpty({ message: 'Either entityName+entityId or category is required' })
  entityName?: string;

  @ApiProperty({ required: false })
  @ValidateIf((o) => !o.category)
  @IsString()
  @IsNotEmpty({ message: 'Either entityName+entityId or category is required' })
  entityId?: string;

  @ApiProperty({ required: false })
  @ValidateIf((o) => !o.entityName && !o.entityId)
  @IsString()
  @IsNotEmpty({ message: 'Either entityName+entityId or category is required' })
  category?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lang: string;

  @ApiProperty({ type: [BatchTranslationPayloadItemDto] })
  @IsArray()
  @ArrayMaxSize(50, { message: 'Batch size exceeds maximum of 50' })
  translations: BatchTranslationPayloadItemDto[];
}
