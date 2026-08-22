import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ChatSession {
  @ApiProperty({ type: String })
  @Expose()
  id: string;

  @ApiProperty({ type: Number })
  @Expose()
  userId: number;

  @ApiPropertyOptional({ type: String, description: 'null = use default agent config' })
  @Expose()
  agentConfigId: string | null;

  @ApiProperty({ type: String })
  @Expose()
  title: string;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}