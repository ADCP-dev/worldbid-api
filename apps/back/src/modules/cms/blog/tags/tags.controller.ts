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
import { TagsService } from './tags.service';
import { CreateTagDto } from '../posts/dto/create-tag.dto';
import { UpdateTagDto } from '../posts/dto/update-tag.dto';
import { FindAllTagDto } from '../posts/dto/find-all-tag.dto';
import { ApiBearerAuth, ApiTags, ApiParam } from '@nestjs/swagger';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@iam/roles/roles.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('CMS Blog Tags')
@Controller({
  path: 'cms/tags',
  version: '1',
})
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @Roles(RoleEnum.admin)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createTagDto: CreateTagDto, @Query('lang') lang?: string) {
    return this.tagsService.create(createTagDto, lang);
  }

  @Get()
  findAll(@Query() query: FindAllTagDto) {
    return this.tagsService.findAll(query);
  }

  @Get(':id')
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string, @Query('lang') lang?: string) {
    return this.tagsService.findOne(id, lang);
  }

  @Patch(':id')
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body() updateTagDto: UpdateTagDto,
    @Query('lang') lang?: string,
  ) {
    return this.tagsService.update(id, updateTagDto, lang);
  }

  @Delete(':id')
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.tagsService.remove(id);
  }
}
