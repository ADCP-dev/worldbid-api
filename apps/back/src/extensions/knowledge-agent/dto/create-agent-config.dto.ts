import { IsArray, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AgentConfigPermissionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  allow: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  deny: string[];
}

export class CreateAgentConfigDto {
  @ApiProperty({ type: String, maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ type: String })
  @IsString()
  systemPrompt: string;

  @ApiProperty({ type: String, description: 'Model string for createDeepAgent, e.g. "openrouter:z-ai/glm-5.2"' })
  @IsString()
  @MaxLength(255)
  model: string;

  @ApiProperty({ type: String, description: '"ollama" | "openrouter"' })
  @IsString()
  @MaxLength(64)
  provider: string;

  @ApiPropertyOptional({ type: AgentConfigPermissionsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AgentConfigPermissionsDto)
  permissions?: AgentConfigPermissionsDto;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mcpServerIds?: string[];
}