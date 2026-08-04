import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class AppSetting {
  @ApiProperty({
    type: String,
  })
  @Expose()
  id: string;

  @ApiProperty({ type: String })
  @Expose()
  key: string;

  @ApiProperty({
    type: Object,
    description: 'jsonb value. For ordering keys: Record<id, number>',
  })
  @Expose()
  value: Record<string, unknown>;

  @ApiProperty({ type: String, nullable: true, required: false })
  @Expose()
  section: string | null;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}
