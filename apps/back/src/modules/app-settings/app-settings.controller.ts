import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';

import { NullableType } from '@infra/utils/types/nullable.type';
import { AppSetting } from '@settings/domain/app-setting';
import { AppSettingsService } from '@settings/app-settings.service';
import { UpsertAppSettingDto } from '@settings/dto/upsert-app-setting.dto';
import { RolesGuard } from '@iam/roles/roles.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('AppSettings')
@Controller({
  path: 'settings',
  version: '1',
})
export class AppSettingsController {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  @ApiOkResponse({
    type: [AppSetting],
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(): Promise<AppSetting[]> {
    return this.appSettingsService.findAll();
  }

  @ApiOkResponse({
    type: AppSetting,
  })
  @ApiParam({
    name: 'key',
    type: String,
    required: true,
  })
  @Get(':key')
  @HttpCode(HttpStatus.OK)
  findByKey(
    @Param('key') key: string,
  ): Promise<NullableType<AppSetting>> {
    return this.appSettingsService.findByKey(key);
  }

  @ApiOkResponse({
    type: AppSetting,
  })
  @ApiParam({
    name: 'key',
    type: String,
    required: true,
  })
  @Roles(RoleEnum.admin)
  @Put(':key')
  @HttpCode(HttpStatus.OK)
  upsert(
    @Param('key') key: string,
    @Body() upsertAppSettingDto: UpsertAppSettingDto,
  ): Promise<AppSetting> {
    return this.appSettingsService.upsert(key, upsertAppSettingDto);
  }

  @Roles(RoleEnum.admin)
  @Delete(':key')
  @ApiParam({
    name: 'key',
    type: String,
    required: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('key') key: string): Promise<void> {
    return this.appSettingsService.deleteByKey(key);
  }
}