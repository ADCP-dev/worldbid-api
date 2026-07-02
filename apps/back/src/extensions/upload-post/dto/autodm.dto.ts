import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsInt, IsBoolean, Min, Max } from 'class-validator';

export class StartAutodmDto {
  @ApiProperty({ example: 'https://instagram.com/p/Cxxx' })
  @IsString()
  postUrl: string;

  @ApiProperty({ example: '¡Gracias por comentar! Te envío el link: ...' })
  @IsString()
  replyMessage: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profileUsername?: string;

  @ApiProperty({ required: false, minimum: 15 })
  @IsOptional()
  @IsInt()
  @Min(15)
  monitoringInterval?: number;

  @ApiProperty({ required: false, type: [String], description: 'Keywords to filter comments' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  triggerKeywords?: string[];
}

export class AutodmMonitorIdDto {
  @ApiProperty()
  @IsString()
  monitorId: string;
}

export class AutodmStatusDto {
  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;
}

export class AutodmLogsDto {
  @ApiProperty()
  @IsString()
  monitorId: string;
}