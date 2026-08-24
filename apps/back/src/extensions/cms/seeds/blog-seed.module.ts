import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogPostEntity } from '@ext/cms/blog/posts/infrastructure/entities/blog-post.entity';
import { TagEntity } from '@ext/cms/blog/posts/infrastructure/entities/post-tag.entity';
import { BlogCategoryEntity } from '@ext/cms/blog/categories/infrastructure/entities/blog-category.entity';
import { TranslationEntity } from '@src/modules/translations/infrastructure/entities/translation.entity';
import { LangEntity } from '@src/modules/translations/infrastructure/entities/lang.entity';
import { UserEntity } from '@users/infrastructure/entities/user.entity';
import { BlogSeedService } from './blog-seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BlogPostEntity,
      TagEntity,
      BlogCategoryEntity,
      TranslationEntity,
      LangEntity,
      UserEntity,
    ]),
  ],
  providers: [BlogSeedService],
  exports: [BlogSeedService],
})
export class BlogSeedModule {}
