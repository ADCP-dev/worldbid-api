import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { FileEntity } from '@storage/files/infrastructure/entities/file.entity';

@Entity({
  name: 'seo_metadata',
})
export class SeoMetadataEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  pageId: string;

  @Index()
  @Column({ type: String, length: 10 })
  lang: string;

  @Column({ type: String, length: 70, nullable: true })
  metaTitle: string | null;

  @Column({ type: String, length: 160, nullable: true })
  metaDescription: string | null;

  @Column({ type: 'simple-array', nullable: true })
  metaKeywords: string[] | null;

  @ManyToOne(() => FileEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ogImageId' })
  ogImage?: FileEntity | null;

  @Column({ type: 'uuid', nullable: true })
  ogImageId?: string | null;

  @Column({ type: String, nullable: true })
  canonicalUrl: string | null;

  @Column({ type: String, length: 70, nullable: true })
  ogTitle: string | null;

  @Column({ type: String, length: 200, nullable: true })
  ogDescription: string | null;

  @Column({ type: 'jsonb', nullable: true })
  customJsonLd: Record<string, any> | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  type?: 'WebPage' | 'Article' | 'WebSite';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
