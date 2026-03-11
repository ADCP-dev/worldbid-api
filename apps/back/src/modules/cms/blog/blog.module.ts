import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogPostsController } from './posts/posts.controller';
import { BlogPostsService } from './posts/posts.service';
import { BlogPostEntity } from './posts/infrastructure/entities/blog-post.entity';
import { BlogCategoriesController } from './categories/categories.controller';
import { BlogCategoriesService } from './categories/categories.service';
import { BlogCategoryEntity } from './categories/infrastructure/entities/blog-category.entity';
import { FilesModule } from '@storage/files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlogPostEntity, BlogCategoryEntity]),
    FilesModule.register(),
  ],
  controllers: [BlogPostsController, BlogCategoriesController],
  providers: [BlogPostsService, BlogCategoriesService],
  exports: [BlogPostsService, BlogCategoriesService],
})
export class BlogModule {}
