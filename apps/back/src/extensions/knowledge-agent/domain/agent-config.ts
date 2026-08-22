import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class AgentConfigPermissions {
  @ApiProperty({ type: [String] })
  @Expose()
  allow: string[];

  @ApiProperty({ type: [String] })
  @Expose()
  deny: string[];
}

export class AgentConfig {
  @ApiProperty({ type: String })
  @Expose()
  id: string;

  @ApiProperty({ type: String })
  @Expose()
  name: string;

  @ApiProperty({ type: String })
  @Expose()
  systemPrompt: string;

  @ApiProperty({ type: String, description: 'Model string for createDeepAgent, e.g. "openrouter:z-ai/glm-5.2"' })
  @Expose()
  model: string;

  @ApiProperty({ type: String, description: '"ollama" | "openrouter"' })
  @Expose()
  provider: string;

  @ApiProperty({ type: AgentConfigPermissions })
  @Expose()
  permissions: AgentConfigPermissions;

  @ApiProperty({ type: [String] })
  @Expose()
  mcpServerIds: string[];

  @ApiProperty({ type: Number })
  @Expose()
  userId: number;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}