import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { TranslationsService } from '../translations.service';
import { LangEntity } from '../infrastructure/entities/lang.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import prompts from 'prompts';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const translationsService = app.get(TranslationsService);
  const langRepository = app.get<Repository<LangEntity>>(
    getRepositoryToken(LangEntity),
  );

  const langs = await langRepository.find({ where: { isActive: true } });

  if (langs.length === 0) {
    console.error(
      'No active languages found in the database. Please seed first.',
    );
    await app.close();
    process.exit(1);
  }

  const response = await prompts([
    {
      type: 'select',
      name: 'langId',
      message: 'Select the Language:',
      choices: langs.map((l) => ({ title: l.name, value: l.id })),
    },
    {
      type: 'select',
      name: 'appContext',
      message: 'Select the target application:',
      choices: [
        { title: 'Front (front)', value: 'front' },
        { title: 'Back (back)', value: 'back' },
        { title: 'Common (both)', value: 'common' },
      ],
    },
    {
      type: 'text',
      name: 'section',
      message: 'Enter the translation section (e.g., landing.hero):',
    },
    {
      type: 'text',
      name: 'key',
      message: 'Enter the translation key (e.g., title):',
    },
    {
      type: 'text',
      name: 'content',
      message: 'Enter the actual translated text:',
    },
  ]);

  if (
    !response.langId ||
    !response.appContext ||
    response.section === undefined ||
    response.key === undefined ||
    response.content === undefined
  ) {
    console.log('Cancelled.');
    await app.close();
    process.exit(0);
  }

  try {
    await translationsService.createTranslation({
      langId: response.langId,
      app: response.appContext,
      section: response.section,
      key: response.key,
      content: response.content,
    });
    console.log('Translation added successfully!');
  } catch (error) {
    console.error('Error adding translation:', error.message);
  }

  await app.close();
}

void bootstrap();
