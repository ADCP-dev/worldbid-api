import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class McpServer {
  @ApiProperty({ type: String })
  @Expose()
  id: string;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  agentConfigId: string | null;

  @ApiProperty({ type: String })
  @Expose()
  name: string;

  @ApiProperty({ type: String, description: '"http" | "stdio"' })
  @Expose()
  transport: string;

  @ApiProperty({ type: String, description: 'URL for http transport, command for stdio' })
  @Expose()
  url: string;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  apiKeyRef: string | null;

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