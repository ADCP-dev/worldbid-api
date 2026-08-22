import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateChatSessionDto {
  @ApiPropertyOptional({ type: String, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ type: String, description: 'UUID of an existing AgentConfig (null = default)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  agentConfigId?: string;
}