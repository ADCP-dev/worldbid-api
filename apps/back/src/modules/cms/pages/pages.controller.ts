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
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { FindAllPageDto } from './dto/find-all-page.dto';
import { ApiBearerAuth, ApiTags, ApiParam } from '@nestjs/swagger';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@iam/roles/roles.guard';

@ApiTags('CMS Pages')
@Controller({
  path: 'cms/pages',
  version: '1',
})
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPageDto: CreatePageDto) {
    return this.pagesService.create(createPageDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  findAll(@Query() query: FindAllPageDto) {
    return this.pagesService.findAll(query);
  }

  @Get('public')
  findAllPublic(
    @Query('lang') lang: string = 'es',
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.pagesService.findAllPublished(lang, page, limit);
  }

  @Get('public/:slug')
  @HttpCode(HttpStatus.OK)
  findOnePublic(@Param('slug') slug: string) {
    return this.pagesService.findBySlugPublic(slug);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.pagesService.findById(id);
  }

  @Get(':id/preview')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  preview(@Param('id') id: string) {
    return this.pagesService.findById(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  update(@Param('id') id: string, @Body() updatePageDto: UpdatePageDto) {
    return this.pagesService.update(id, updatePageDto);
  }

  @Patch(':id/reorder')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.NO_CONTENT)
  reorder(@Body('orderedIds') orderedIds: string[]) {
    return this.pagesService.reorder(orderedIds);
  }

  @Patch(':id/publish')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.OK)
  publish(@Param('id') id: string, @Body('isPublished') isPublished: boolean) {
    return this.pagesService.publish(id, isPublished);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.pagesService.remove(id);
  }
}
