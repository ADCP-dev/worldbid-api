import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class Note {
  @ApiProperty({ type: String })
  @Expose()
  id: string;

  @ApiProperty({ type: String })
  @Expose()
  title: string;

  @ApiProperty({ type: String })
  @Expose()
  contentMd: string;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  categoryPath: string | null;

  @ApiProperty({ type: [String] })
  @Expose()
  tags: string[];

  @ApiProperty({ type: Object })
  @Expose()
  frontmatter: Record<string, unknown>;

  @ApiProperty({ type: Array, nullable: true })
  @Expose()
  embedding: number[] | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Creator provenance — metadata only, NOT scoping' })
  @Expose()
  userId: number | null;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  @Expose()
  deletedAt: Date | null;
}