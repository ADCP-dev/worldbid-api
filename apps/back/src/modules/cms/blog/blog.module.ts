import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogPostsController } from './posts/posts.controller';
import { BlogPostsService } from './posts/posts.service';
import { BlogPostEntity } from './posts/infrastructure/entities/blog-post.entity';
import { TagEntity } from './posts/infrastructure/entities/post-tag.entity';
import { BlogCategoriesController } from './categories/categories.controller';
import { BlogCategoriesService } from './categories/categories.service';
import { BlogCategoryEntity } from './categories/infrastructure/entities/blog-category.entity';
import { TagsController } from './tags/tags.controller';
import { TagsService } from './tags/tags.service';
import { FilesModule } from '@storage/files/files.module';
import { TranslationsModule } from '@src/modules/translations/translations.module';
import { TranslationEntity } from '@src/modules/translations/infrastructure/entities/translation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlogPostEntity, TagEntity, BlogCategoryEntity, TranslationEntity]),
    FilesModule.register(),
    TranslationsModule,
  ],
  controllers: [BlogPostsController, BlogCategoriesController, TagsController],
  providers: [BlogPostsService, BlogCategoriesService, TagsService],
  exports: [BlogPostsService, BlogCategoriesService, TagsService],
})
export class BlogModule {}
