import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ type: String, maxLength: 32000 })
  @IsString()
  @MaxLength(32000)
  message: string;
}