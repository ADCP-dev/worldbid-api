import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class FileUploadDto {
  @ApiProperty({ example: 'image.jpg' })
  @IsString()
  fileName: string;

  @ApiProperty({ example: 138723 })
  @IsNumber()
  fileSize: number;

  @ApiProperty({
    required: false,
    default: true,
    description: 'Whether the file is publicly accessible',
  })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
