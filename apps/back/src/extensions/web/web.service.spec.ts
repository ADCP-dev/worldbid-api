// RED (task 2.3): web.service.spec.ts
// Verifies WebService.submit() behavior (R-CS-05/06/07):
//   - honeypot filled → returns {success:true} WITHOUT calling MailService
//   - valid + honeypot empty → calls mailService.contactFormNotification
//   - send failure → throws (controller catch → 500)

import { Test, TestingModule } from '@nestjs/testing';
import { WebService } from './web.service';
import { MailService } from '@comms/mail/mail.service';

describe('WebService', () => {
  let service: WebService;
  let mailService: { contactFormNotification: jest.Mock };

  beforeEach(async () => {
    mailService = {
      contactFormNotification: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebService,
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<WebService>(WebService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('submit', () => {
    const validDto = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      message: 'Hello, I would like to know more about your services.',
    };

    it('should call mailService.contactFormNotification on a valid DTO and return {success:true}', async () => {
      const result = await service.submit(validDto);

      expect(result).toEqual({ success: true });
      expect(mailService.contactFormNotification).toHaveBeenCalledTimes(1);
      expect(mailService.contactFormNotification).toHaveBeenCalledWith(
        validDto.name,
        validDto.email,
        validDto.message,
        undefined,
      );
    });

    it('should pass lang through to contactFormNotification when provided', async () => {
      await service.submit({ ...validDto, lang: 'en' });

      expect(mailService.contactFormNotification).toHaveBeenCalledWith(
        validDto.name,
        validDto.email,
        validDto.message,
        'en',
      );
    });

    it('should NOT call MailService and return {success:true} when honeypot is filled (silent bot discard)', async () => {
      const result = await service.submit({ ...validDto, website: 'http://spam.example.com' });

      expect(result).toEqual({ success: true });
      expect(mailService.contactFormNotification).not.toHaveBeenCalled();
    });

    it('should throw when MailService.contactFormNotification rejects (real send failure)', async () => {
      mailService.contactFormNotification.mockRejectedValue(new Error('SMTP down'));

      await expect(service.submit(validDto)).rejects.toThrow('SMTP down');
      expect(mailService.contactFormNotification).toHaveBeenCalledTimes(1);
    });
  });
});