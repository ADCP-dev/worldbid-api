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
  SerializeOptions,
  Req,
} from '@nestjs/common';
import { CreateUserDto } from '@users/dto/create-user.dto';
import { UpdateUserDto } from '@users/dto/update-user.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';

import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '@infra/utils/dto/infinity-pagination-response.dto';
import { NullableType } from '@infra/utils/types/nullable.type';
import { User } from '@users/domain/user';
import { UsersService } from '@users/users.service';
import { RolesGuard } from '@iam/roles/roles.guard';
import { FindAllUserPaginatedDto } from '@users/dto/find-all-user-paginated.dto';
import { FindAllUserDto } from '@users/dto/find-all-user.dto';
import { Request } from 'express';

@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('Users')
@Controller({
  path: 'users',
  version: '1',
})
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiCreatedResponse({
    type: User,
  })
  @SerializeOptions({
    groups: ['admin'],
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProfileDto: CreateUserDto): Promise<User> {
    return this.usersService.create(createProfileDto);
  }

  @ApiOkResponse({
    type: InfinityPaginationResponse(User),
  })
  @SerializeOptions({
    groups: ['admin'],
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  findAllWithPagination(
    @Query() query: FindAllUserPaginatedDto,
    @Req() req: Request,
  ): Promise<InfinityPaginationResponseDto<User>> {
    query.originalUrl = req.originalUrl; // For pagination
    return this.usersService.findAllWithPagination(query);
  }

  @ApiOkResponse({
    type: [User],
  })
  @SerializeOptions({
    groups: ['admin'],
  })
  @Get('all')
  @HttpCode(HttpStatus.OK)
  findAll(@Query() query: FindAllUserDto) {
    return this.usersService.findAll(query);
  }

  @ApiOkResponse({
    type: User,
  })
  @SerializeOptions({
    groups: ['admin'],
  })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  findOne(@Param('id') id: User['id']): Promise<NullableType<User>> {
    return this.usersService.findById(id);
  }

  @ApiOkResponse({
    type: User,
  })
  @SerializeOptions({
    groups: ['admin'],
  })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  update(
    @Param('id') id: User['id'],
    @Body() updateProfileDto: UpdateUserDto,
  ): Promise<User | null> {
    return this.usersService.update(id, updateProfileDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: User['id']): Promise<void> {
    return this.usersService.remove(id);
  }
}
