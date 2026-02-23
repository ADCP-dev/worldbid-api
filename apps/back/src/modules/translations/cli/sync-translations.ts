import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { TranslationsService } from '../translations.service';
import { TranslationSeedService } from '../infrastructure/seeds/translation-seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    console.log('Starting translation sync...');

    const translationSeedService = app.get(TranslationSeedService);
    const translationsService = app.get(TranslationsService);

    // Step 1: Read any new JSON additions (developer added strings directly to flat files)
    console.log('1. Seeding JSON files to DB...');
    await translationSeedService.run();

    // Step 2: Regenerate JSON files (fetch all static DB values out to JSON)
    console.log('2. Generating JSON files from DB...');
    const result = await translationsService.generateJsonFiles();
    console.log(result.message);

    console.log('Sync complete!');
  } catch (error) {
    console.error('Sync failed:', error);
  } finally {
    await app.close();
  }
}

void bootstrap();
