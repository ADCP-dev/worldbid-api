import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class PermissionDto {
  @ApiProperty()
  @IsNumber()
  id: number | string;

  @ApiProperty()
  @IsString()
  name: string;
}
