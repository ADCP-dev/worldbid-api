import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMcpServerDto {
  @ApiPropertyOptional({ type: String, description: 'UUID of the parent agent config (null = global)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  agentConfigId?: string;

  @ApiProperty({ type: String, maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ type: String, description: '"http" | "stdio"' })
  @IsString()
  @MaxLength(16)
  transport: string;

  @ApiProperty({ type: String, description: 'URL for http transport, command for stdio' })
  @IsString()
  @MaxLength(512)
  url: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  apiKeyRef?: string;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}