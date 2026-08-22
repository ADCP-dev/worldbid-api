import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class Model {
  @ApiProperty({ type: String })
  @Expose()
  id: string;

  @ApiProperty({ type: String })
  @Expose()
  providerId: string;

  @ApiProperty({ type: String, description: 'Provider-specific model id, e.g. "glm-5.2"' })
  @Expose()
  modelId: string;

  @ApiProperty({ type: String })
  @Expose()
  displayName: string;

  @ApiProperty({ type: Number })
  @Expose()
  contextWindow: number;

  @ApiProperty({ type: Boolean })
  @Expose()
  active: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}