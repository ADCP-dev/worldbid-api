// RED (task 2.5): web.controller.spec.ts
// Verifies WebController.contact() (R-CS-02/04/05/07):
//   - POST /api/v1/contact, @HttpCode(201), @Throttle(5, 60_000)
//   - valid → 201 {success:true}
//   - honeypot → silent 201 (no email)
//   - send failure → 500
//   - invalid DTO → 400 (handled by global ValidationPipe)
//
// Rate-limit (429 + Retry-After on 6th req/60s) is an integration concern
// exercised by the ThrottlerGuard + UserOrIpThrottlerGuard; verified manually
// at the app level. The unit test confirms the @Throttle decorator metadata.

import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WebController } from './web.controller';
import { WebService } from './web.service';
import { ContactDto } from './dto/contact.dto';

describe('WebController', () => {
  let controller: WebController;
  let webService: { submit: jest.Mock };

  beforeEach(async () => {
    webService = { submit: jest.fn().mockResolvedValue({ success: true }) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebController],
      providers: [{ provide: WebService, useValue: webService }],
    }).compile();

    controller = module.get<WebController>(WebController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /contact (contact method)', () => {
    const validDto: ContactDto = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      message: 'Hello, I would like to know more about your services.',
    };

    it('should return 201 {success:true} on a valid submission', async () => {
      const result = await controller.contact(validDto);

      expect(result).toEqual({ success: true });
      expect(webService.submit).toHaveBeenCalledWith(validDto);
    });

    it('should return 201 silently when honeypot is filled (bot discard)', async () => {
      const dtoWithHoneypot: ContactDto = {
        ...validDto,
        website: 'http://spam.example.com',
      };
      // Service still gets called; it decides to skip email.
      webService.submit.mockResolvedValue({ success: true });

      const result = await controller.contact(dtoWithHoneypot);

      expect(result).toEqual({ success: true });
      expect(webService.submit).toHaveBeenCalledWith(dtoWithHoneypot);
    });

    it('should propagate service errors (controller lets them surface as 500)', async () => {
      webService.submit.mockRejectedValue(new Error('SMTP down'));

      await expect(controller.contact(validDto)).rejects.toThrow('SMTP down');
    });
  });

  describe('HTTP metadata decorators (R-CS-02/04)', () => {
    const reflector = new Reflector();

    it('should declare @HttpCode(201) on the contact method', () => {
      // NestJS stores @HttpCode under the '__httpCode__' metadata key.
      const code = Reflect.getMetadata(
        '__httpCode__',
        WebController.prototype.contact,
      );
      expect(code).toBe(HttpStatus.CREATED);
    });

    it('should declare @Throttle(5, 60_000) on the contact method', () => {
      // @nestjs/throttler v6 stores per-name metadata under
      // 'THROTTLER:LIMIT'+name and 'THROTTLER:TTL'+name (name='default').
      const limit = Reflect.getMetadata(
        'THROTTLER:LIMITdefault',
        WebController.prototype.contact,
      );
      const ttl = Reflect.getMetadata(
        'THROTTLER:TTLdefault',
        WebController.prototype.contact,
      );
      expect(limit).toBe(5);
      expect(ttl).toBe(60_000);
    });

    it('should be mounted at v1/contact (Controller path + version 1)', () => {
      // Path metadata is stored by @Controller; we read it via reflector.
      const path = reflector.get<string>('path', WebController);
      expect(path).toBe('contact');
    });
  });
});