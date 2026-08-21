// RED (task 2.9): mail.service.contact.spec.ts
// Verifies MailService.contactFormNotification (R-CS-06/07, GAP2):
//   - renders the Handlebars template via mailerService.sendMail (sync, NOT queued)
//   - sends to configService.getOrThrow('app.notificationEmail')
//   - uses getMailTemplatePath('contact-notification.hbs')
//   - throws on SMTP failure (controller catch → 500)

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { MailService } from './mail.service';
import { MailerService } from '@infra/mailer/mailer.service';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';
import {
  getMailTemplatePath,
  initMailTemplatePath,
} from './helpers/mail-template-path.helper';

describe('MailService.contactFormNotification', () => {
  let service: MailService;
  let mailerService: { sendMail: jest.Mock };
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };

  beforeEach(async () => {
    mailerService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'app.name') return 'Foundation';
        if (key === 'app.backendDomain') return 'http://localhost:3000';
        if (key === 'app.workingDirectory') return '/app';
        return undefined;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'app.notificationEmail') return 'hello@example.com';
        if (key === 'app.backendDomain') return 'http://localhost:3000';
        if (key === 'app.workingDirectory') return '/app';
        throw new Error(`Missing config: ${key}`);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: mailerService },
        { provide: QueuedMailerService, useValue: { sendMail: jest.fn() } },
        { provide: ConfigService, useValue: configService },
        { provide: I18nService, useValue: { t: jest.fn((k: string) => k) } },
      ],
    }).compile();

    service = module.get<MailService>(MailService);

    // The template-path helper is process-global and initialized by MailModule
    // at app boot. Initialize it here with the mock ConfigService so
    // getMailTemplatePath resolves during the test.
    initMailTemplatePath(configService as unknown as ConfigService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send a sync email (mailerService.sendMail, NOT queuedMailerService) to app.notificationEmail', async () => {
    await service.contactFormNotification('Ada', 'ada@example.com', 'Hello world');

    expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
    const args = mailerService.sendMail.mock.calls[0][0];
    expect(args.to).toBe('hello@example.com');
    expect(args.templatePath).toBe(getMailTemplatePath('contact-notification.hbs'));
    expect(args.context.name).toBe('Ada');
    expect(args.context.email).toBe('ada@example.com');
    expect(args.context.message).toBe('Hello world');
  });

  it('should throw when notificationEmail is not configured (getOrThrow)', async () => {
    configService.getOrThrow.mockImplementationOnce((key: string) => {
      if (key === 'app.notificationEmail') {
        throw new Error('Missing config: app.notificationEmail');
      }
      if (key === 'app.backendDomain') return 'http://localhost:3000';
      throw new Error(`Missing config: ${key}`);
    });

    await expect(
      service.contactFormNotification('Ada', 'ada@example.com', 'Hello world'),
    ).rejects.toThrow(/notificationEmail/);
    expect(mailerService.sendMail).not.toHaveBeenCalled();
  });

  it('should throw when mailerService.sendMail fails (SMTP down)', async () => {
    mailerService.sendMail.mockRejectedValue(new Error('SMTP down'));

    await expect(
      service.contactFormNotification('Ada', 'ada@example.com', 'Hello world'),
    ).rejects.toThrow('SMTP down');
  });

  it('should pass lang into the template context when provided', async () => {
    await service.contactFormNotification('Ada', 'ada@example.com', 'Hello world', 'en');

    const args = mailerService.sendMail.mock.calls[0][0];
    expect(args.context.lang).toBe('en');
  });

  it('should default lang to "es" when omitted', async () => {
    await service.contactFormNotification('Ada', 'ada@example.com', 'Hello world');

    const args = mailerService.sendMail.mock.calls[0][0];
    expect(args.context.lang).toBe('es');
  });
});