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
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { FileEntity } from '@storage/files/infrastructure/entities/file.entity';
import { UserEntity } from '@users/infrastructure/entities/user.entity';
import { TagEntity } from './post-tag.entity';
import { BlogCategoryEntity } from '../../../categories/infrastructure/entities/blog-category.entity';

@Entity({
  name: 'ext_cms_blog_post',
})
export class BlogPostEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: String })
  slug: string;

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

  @ManyToOne(
    () => BlogCategoryEntity,
    (category: BlogCategoryEntity) => category.posts,
    {
      nullable: true,
      onDelete: 'SET NULL',
    },
  )
  @JoinColumn({ name: 'categoryId' })
  category?: BlogCategoryEntity | null;

  @Column({ type: 'uuid', nullable: true })
  categoryId?: string | null;

  @ManyToMany(() => TagEntity, (tag: TagEntity) => tag.posts, {
    cascade: true,
  })
  @JoinTable({
    name: 'ext_cms_blog_post_tag',
    joinColumn: { name: 'postId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  tags: TagEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
