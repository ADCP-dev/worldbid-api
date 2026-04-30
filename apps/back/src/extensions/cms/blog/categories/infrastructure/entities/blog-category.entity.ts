import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { BlogPostEntity } from '../../../posts/infrastructure/entities/blog-post.entity';
import { TagEntity } from '../../../posts/infrastructure/entities/post-tag.entity';

@Entity({
  name: 'ext_cms_blog_category',
})
export class BlogCategoryEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: String })
  slug: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => BlogCategoryEntity, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parentId' })
  parent?: BlogCategoryEntity | null;

  @OneToMany(() => BlogCategoryEntity, (category) => category.parent)
  children?: BlogCategoryEntity[];

  @OneToMany(() => BlogPostEntity, (post: BlogPostEntity) => post.category)
  posts: BlogPostEntity[];

  @ManyToMany(() => TagEntity, { eager: true })
  @JoinTable({
    name: 'ext_cms_blog_category_tag',
    joinColumn: { name: 'categoryId', referencedColumnName: 'id' },
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
