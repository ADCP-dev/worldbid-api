import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ModelProvider {
  @ApiProperty({ type: String })
  @Expose()
  id: string;

  @ApiProperty({ type: String })
  @Expose()
  name: string;

  @ApiProperty({ type: String, description: '"ollama" | "openrouter"' })
  @Expose()
  provider: string;

  @ApiProperty({ type: String, nullable: true, description: 'Name of env var holding the API key (not the key itself)' })
  @Expose()
  apiKeyRef: string | null;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  baseUrl: string | null;

  @ApiProperty({ type: Boolean })
  @Expose()
  enabled: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}