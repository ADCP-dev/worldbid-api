import { Module, DynamicModule } from '@nestjs/common';
import { FilesModule } from '@storage/files/files.module';

@Module({})
export class StorageModule {
  static register(): DynamicModule {
    return {
      module: StorageModule,
      imports: [FilesModule.register()],
      exports: [FilesModule],
    };
  }
}
