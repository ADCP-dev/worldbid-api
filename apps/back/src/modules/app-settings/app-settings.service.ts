import { Injectable } from '@nestjs/common';
import { UpsertAppSettingDto } from '@settings/dto/upsert-app-setting.dto';
import { AppSettingRepository } from '@settings/infrastructure/app-setting.repository';
import { AppSetting } from '@settings/domain/app-setting';
import { NullableType } from '@infra/utils/types/nullable.type';

@Injectable()
export class AppSettingsService {
  constructor(
    private readonly appSettingRepository: AppSettingRepository,
  ) {}

  findAll(): Promise<AppSetting[]> {
    return this.appSettingRepository.findAll();
  }

  findByKey(key: string): Promise<NullableType<AppSetting>> {
    return this.appSettingRepository.findByKey(key);
  }

  upsert(key: string, data: UpsertAppSettingDto): Promise<AppSetting> {
    return this.appSettingRepository.upsert(key, data);
  }

  deleteByKey(key: string): Promise<void> {
    return this.appSettingRepository.deleteByKey(key);
  }
}