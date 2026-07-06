import 'dotenv/config';
import {
  ClassSerializerInterceptor,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import helmet from 'helmet';
import { AppModule } from './app.module';
import validationOptions from '@infra/utils/validation-options';
import { AllConfigType } from './config/config.type';
import { ResolvePromisesInterceptor } from '@infra/utils/serializer.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ErrorTrackerService } from './modules/error-tracker/error-tracker.service';
import { GlobalExceptionFilter } from './modules/error-tracker/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.set('query parser', 'extended');

  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  const configService = app.get(ConfigService<AllConfigType>);

  const singularDomain = configService.get('app.frontendDomain', {
    infer: true,
  });
  const pluralDomainsCsv = configService.get('app.frontendDomains', {
    infer: true,
  });

  const allowedOrigins = [
    ...(pluralDomainsCsv
      ? pluralDomainsCsv
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean)
      : []),
    ...(singularDomain ? [singularDomain] : []),
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });

  // helmet sets sensible security headers (HSTS, X-Frame-Options,
  // X-Content-Type-Options, Referrer-Policy, ...). Apply after
  // enableCors so the CORS preflight still works for the front-end.
  app.use(helmet());

  app.enableShutdownHooks();
  app.setGlobalPrefix(
    configService.getOrThrow('app.apiPrefix', { infer: true }),
    {
      exclude: ['/'],
    },
  );
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      ...validationOptions,
      transform: true,
      // enableImplicitConversion: removed. With it on, class-transformer
      // converts "123" -> 123 silently, masking type mismatches on
      // bodies (e.g. a string slipping past @IsNumber). If any
      // controller needs implicit conversion for a query DTO, attach
      // a local ValidationPipe with this option on that route instead.
    }),
  );
  app.useGlobalInterceptors(
    // ResolvePromisesInterceptor is used to resolve promises in responses because class-transformer can't do it
    // https://github.com/typestack/class-transformer/issues/549
    new ResolvePromisesInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  const options = new DocumentBuilder()
    .setTitle('API')
    .setDescription('API docs')
    .setVersion('1.0')
    .addBearerAuth()
    .addGlobalParameters({
      in: 'header',
      required: false,
      name: process.env.APP_HEADER_LANGUAGE || 'x-custom-lang',
      schema: {
        example: 'en',
      },
    })
    .build();

  // Swagger exposes every endpoint, DTO, and auth flow. Keep it gated
  // behind a non-production NODE_ENV so the public deployment doesn't
  // hand an attacker a free enumeration map.
  if (process.env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup('docs', app, document);
  }

  const errorTrackerService = app.get(ErrorTrackerService);
  app.useGlobalFilters(new GlobalExceptionFilter(errorTrackerService));

  process.on('unhandledRejection', (reason: unknown) => {
    errorTrackerService
      .logError({
        message: reason instanceof Error ? reason.message : String(reason),
        source: 'NestJS Process - unhandledRejection',
        stack: reason instanceof Error ? reason.stack : undefined,
      })
      .catch(console.error);
  });

  process.on('uncaughtException', (error: Error) => {
    void errorTrackerService
      .logError({
        message: error.message,
        source: 'NestJS Process - uncaughtException',
        stack: error.stack,
      })
      .finally(() => process.exit(1));
  });

  await app.listen(configService.getOrThrow('app.port', { infer: true }));
}
void bootstrap();
