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
import { UserEntity } from '@users/infrastructure/entities/user.entity';

export enum PageTemplate {
  LANDING = 'landing',
  GENERIC = 'generic',
  CONTACT = 'contact',
}

@Entity({
  name: 'page',
})
export class PageEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: String })
  slug: string;

  @Column({ type: String, nullable: true })
  route: string;

  @Column({
    type: String,
    enum: PageTemplate,
    default: PageTemplate.GENERIC,
  })
  template: PageTemplate;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'boolean', default: false })
  isPublished: boolean;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @ManyToOne(() => FileEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'featuredImageId' })
  featuredImage?: FileEntity | null;

  @Column({ type: 'uuid', nullable: true })
  featuredImageId?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author?: UserEntity | null;

  @Column({ type: 'int', nullable: true })
  authorId?: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
