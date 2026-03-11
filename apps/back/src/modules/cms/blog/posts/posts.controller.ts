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
} from '@nestjs/common';
import { BlogPostsService } from './posts.service';
import { CreateBlogPostDto } from './dto/create-post.dto';
import { UpdateBlogPostDto } from './dto/update-post.dto';
import { FindAllBlogPostDto } from './dto/find-all-post.dto';
import { ApiBearerAuth, ApiTags, ApiParam } from '@nestjs/swagger';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@iam/roles/roles.guard';

@ApiTags('CMS Blog Posts')
@Controller({
  path: 'cms/blog/posts',
  version: '1',
})
export class BlogPostsController {
  constructor(private readonly blogPostsService: BlogPostsService) {}

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
  findAllPublic(
    @Query('lang') lang: string = 'es',
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.blogPostsService.findAllPublished(lang, page, limit);
  }

  @Get('public/:slug')
  @HttpCode(HttpStatus.OK)
  findOnePublic(@Param('slug') slug: string) {
    return this.blogPostsService.findBySlugPublic(slug);
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
  preview(@Param('id') id: string) {
    return this.blogPostsService.findById(id);
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
