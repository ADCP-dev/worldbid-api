import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { AppSettingEntity } from './entities/app-setting.entity';
import { NullableType } from '@infra/utils/types/nullable.type';
import { AppSetting } from '../domain/app-setting';
import { UpsertAppSettingDto } from '../dto/upsert-app-setting.dto';

@Injectable()
export class AppSettingRepository {
  constructor(
    @InjectRepository(AppSettingEntity)
    private readonly appSettingRepository: Repository<AppSettingEntity>,
  ) {}

  async findAll(): Promise<AppSetting[]> {
    const entities = await this.appSettingRepository.find();
    return entities.map((entity) => plainToInstance(AppSetting, entity));
  }

  async findByKey(key: string): Promise<NullableType<AppSetting>> {
    const entity = await this.appSettingRepository.findOne({
      where: { key },
    });
    return entity ? plainToInstance(AppSetting, entity) : null;
  }

  async upsert(key: string, data: UpsertAppSettingDto): Promise<AppSetting> {
    const existing = await this.appSettingRepository.findOne({
      where: { key },
    });

    if (existing) {
      existing.value = data.value;
      if (data.section !== undefined) {
        existing.section = data.section ?? null;
      }
      const updated = await this.appSettingRepository.save(existing);
      return plainToInstance(AppSetting, updated);
    }

    const entity = this.appSettingRepository.create({
      key,
      value: data.value,
      section: data.section ?? null,
    });
    const created = await this.appSettingRepository.save(entity);
    return plainToInstance(AppSetting, created);
  }

  async deleteByKey(key: string): Promise<void> {
    await this.appSettingRepository.delete({ key });
  }
}
