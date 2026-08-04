import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpStatus,
  HttpCode,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BlogPostsService } from './posts.service';
import { TagsService } from '../tags/tags.service';
import { CreateBlogPostDto } from './dto/create-post.dto';
import { UpdateBlogPostDto } from './dto/update-post.dto';
import { FindAllBlogPostDto } from './dto/find-all-post.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@iam/roles/roles.guard';

@ApiTags('CMS Blog Posts')
@Controller('v1/cms/blog/posts')
export class BlogPostsController {
  constructor(
    private readonly blogPostsService: BlogPostsService,
    private readonly tagsService: TagsService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPostDto: CreateBlogPostDto) {
    return this.blogPostsService.create(createPostDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  findAll(@Query() query: FindAllBlogPostDto) {
    return this.blogPostsService.findAll(query);
  }

  @Get('public')
  async findAllPublic(
    @Query('lang') lang: string = 'es',
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('tagSlugs') tagSlugs?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    let tagIds: string[] | undefined;
    if (tagSlugs) {
      const slugs = tagSlugs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const tags = await this.tagsService.findManyBySlugs(slugs, lang);
      tagIds = tags.map((t) => t.id);
    }
    return this.blogPostsService.findAllPublished(
      lang,
      page,
      limit,
      search,
      tagIds,
      categoryId,
    );
  }

  @Get('public/category/:categoryId')
  @HttpCode(HttpStatus.OK)
  findByCategory(
    @Param('categoryId') categoryId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.blogPostsService.findByCategory(categoryId, page, limit);
  }

  @Get('public/:slug')
  @HttpCode(HttpStatus.OK)
  findOnePublic(@Param('slug') slug: string) {
    return this.blogPostsService.findBySlugPublic(slug);
  }

  @Get('public/:slug/related')
  @HttpCode(HttpStatus.OK)
  findRelated(@Param('slug') slug: string, @Query('limit') limit: number = 3) {
    return this.blogPostsService.findRelated(slug, limit);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.blogPostsService.findById(id);
  }

  @Get(':id/preview')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  async preview(@Param('id') id: string) {
    const post = await this.blogPostsService.findById(id);
    return {
      id: post.id,
      slug: post.slug,
      title: (post as any).title || post.slug,
      content: (post as any).content || '',
      featuredImage: post.featuredImage
        ? {
            id: post.featuredImage.id,
            url: post.featuredImage.path,
          }
        : null,
      isPublished: post.isPublished,
      publishedAt: post.publishedAt,
      tags: post.tags,
      category: post.category,
    };
  }

  @Post(':id/featured-image')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  uploadFeaturedImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.blogPostsService.uploadFeaturedImage(id, file);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  update(@Param('id') id: string, @Body() updatePostDto: UpdateBlogPostDto) {
    return this.blogPostsService.update(id, updatePostDto);
  }

  @Patch(':id/publish')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.OK)
  publish(@Param('id') id: string, @Body('isPublished') isPublished: boolean) {
    return this.blogPostsService.publish(id, isPublished);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.blogPostsService.remove(id);
  }
}
