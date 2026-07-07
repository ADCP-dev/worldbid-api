import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { AppSettingsService } from '@settings/app-settings.service';
import { AppSettingsController } from '@settings/app-settings.controller';
import { AppSettingPersistenceModule } from '@settings/infrastructure/persistence.module';

@Module({
  imports: [
    // do not remove this comment
    AppSettingPersistenceModule,
  ],
  controllers: [AppSettingsController],
  providers: [AppSettingsService],
  exports: [AppSettingsService, AppSettingPersistenceModule],
})
export class AppSettingsModule {}
