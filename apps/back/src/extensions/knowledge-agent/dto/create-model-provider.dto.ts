import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModelProviderDto {
  @ApiProperty({ type: String, maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ type: String, description: '"ollama" | "openrouter"' })
  @IsString()
  @MaxLength(64)
  provider: string;

  @ApiPropertyOptional({ type: String, description: 'Name of env var holding the API key (not the key itself)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  apiKeyRef?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  baseUrl?: string;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}