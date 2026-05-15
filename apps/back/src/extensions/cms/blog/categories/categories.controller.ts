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
import { BlogCategoriesService } from './categories.service';
import { CreateBlogCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ApiBearerAuth, ApiTags, ApiParam } from '@nestjs/swagger';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@iam/roles/roles.guard';

@ApiTags('CMS Blog Categories')
@Controller('v1/cms/blog/categories')
export class BlogCategoriesController {
  constructor(private readonly categoriesService: BlogCategoriesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createCategoryDto: CreateBlogCategoryDto,
    @Query('lang') lang: string = 'es',
  ) {
    return this.categoriesService.create(createCategoryDto, lang);
  }

  @Get()
  findAll(@Query('lang') lang: string = 'es') {
    return this.categoriesService.findAll(lang);
  }

  @Get('public')
  findAllPublic(@Query('lang') lang: string = 'es') {
    return this.categoriesService.findAll(lang);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string, @Query('lang') lang: string = 'es') {
    return this.categoriesService.findById(id, lang);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Query('lang') lang: string = 'es',
  ) {
    return this.categoriesService.update(id, updateCategoryDto, lang);
  }

  @Patch(':id/reorder')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.NO_CONTENT)
  reorder(@Body('orderedIds') orderedIds: string[]) {
    return this.categoriesService.reorder(orderedIds);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
