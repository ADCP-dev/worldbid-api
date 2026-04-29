import { Entity, ManyToOne, PrimaryColumn, JoinColumn } from 'typeorm';
import { BlogPostEntity } from './blog-post.entity';
import { TagEntity } from './post-tag.entity';

@Entity({ name: 'blog_post_tag' })
export class BlogPostTagEntity {
  @PrimaryColumn({ type: 'uuid', name: 'postId' })
  postId: string;

  @PrimaryColumn({ type: 'uuid', name: 'tagId' })
  tagId: string;

  @ManyToOne(() => BlogPostEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: BlogPostEntity;

  @ManyToOne(() => TagEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tagId' })
  tag: TagEntity;
}
