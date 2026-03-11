import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { BlogCategoriesService } from './categories.service';
import { CreateBlogCategoryDto } from './dto/create-category.dto';
import { ApiBearerAuth, ApiTags, ApiParam } from '@nestjs/swagger';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@iam/roles/roles.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('CMS Blog Categories')
@Controller({
  path: 'cms/blog/categories',
  version: '1',
})
export class BlogCategoriesController {
  constructor(private readonly categoriesService: BlogCategoriesService) {}

  @Post()
  @Roles(RoleEnum.admin)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createCategoryDto: CreateBlogCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  @Patch(':id')
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'id', type: String })
  update(@Param('id') id: string, @Body() data: any) {
    return this.categoriesService.update(id, data);
  }

  @Patch(':id/reorder')
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.NO_CONTENT)
  reorder(@Body('orderedIds') orderedIds: string[]) {
    return this.categoriesService.reorder(orderedIds);
  }

  @Delete(':id')
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
