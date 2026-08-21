// RED (task 2.1): contact.dto.spec.ts
// Verifies class-validator rules for the public contact form DTO (R-CS-02).
// Uses plainToInstance + validateSync (same engine NestJS uses at runtime).

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ContactDto } from './contact.dto';

function violations(dto: ContactDto): string[] {
  const instance = plainToInstance(ContactDto, dto);
  return validateSync(instance).map((e) => e.property);
}

describe('ContactDto', () => {
  it('should be defined after import', () => {
    // Guarantees the module loaded (RED would fail to import a non-existent file).
    expect(ContactDto).toBeDefined();
  });

  describe('name', () => {
    it('should accept a valid name (>=2 chars)', () => {
      const errors = violations({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'Hello there, this is a valid message.',
      } as ContactDto);
      expect(errors).not.toContain('name');
    });

    it('should reject a name shorter than 2 chars', () => {
      const errors = violations({
        name: 'A',
        email: 'ada@example.com',
        message: 'Hello there, this is a valid message.',
      } as ContactDto);
      expect(errors).toContain('name');
    });

    it('should reject a missing name', () => {
      const errors = violations({
        email: 'ada@example.com',
        message: 'Hello there, this is a valid message.',
      } as unknown as ContactDto);
      expect(errors).toContain('name');
    });
  });

  describe('email', () => {
    it('should accept a valid email', () => {
      const errors = violations({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'Hello there, this is a valid message.',
      } as ContactDto);
      expect(errors).not.toContain('email');
    });

    it('should reject an invalid email', () => {
      const errors = violations({
        name: 'Ada',
        email: 'not-an-email',
        message: 'Hello there, this is a valid message.',
      } as ContactDto);
      expect(errors).toContain('email');
    });

    it('should reject a missing email', () => {
      const errors = violations({
        name: 'Ada',
        message: 'Hello there, this is a valid message.',
      } as unknown as ContactDto);
      expect(errors).toContain('email');
    });
  });

  describe('message', () => {
    it('should accept a message of 10 chars', () => {
      const errors = violations({
        name: 'Ada',
        email: 'ada@example.com',
        message: '1234567890',
      } as ContactDto);
      expect(errors).not.toContain('message');
    });

    it('should reject a message shorter than 10 chars', () => {
      const errors = violations({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'short',
      } as ContactDto);
      expect(errors).toContain('message');
    });

    it('should reject a message longer than 5000 chars', () => {
      const errors = violations({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'x'.repeat(5001),
      } as ContactDto);
      expect(errors).toContain('message');
    });
  });

  describe('website (honeypot)', () => {
    it('should accept when website is omitted', () => {
      const errors = violations({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'Hello there, this is a valid message.',
      } as ContactDto);
      expect(errors).not.toContain('website');
    });

    it('should accept when website is a string (honeypot filled by bot)', () => {
      const errors = violations({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'Hello there, this is a valid message.',
        website: 'http://spam.example.com',
      } as ContactDto);
      expect(errors).not.toContain('website');
    });
  });

  describe('lang', () => {
    it('should accept lang=es', () => {
      const errors = violations({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'Hello there, this is a valid message.',
        lang: 'es',
      } as ContactDto);
      expect(errors).not.toContain('lang');
    });

    it('should accept lang=en', () => {
      const errors = violations({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'Hello there, this is a valid message.',
        lang: 'en',
      } as ContactDto);
      expect(errors).not.toContain('lang');
    });

    it('should reject lang=fr (not in allowed list)', () => {
      const errors = violations({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'Hello there, this is a valid message.',
        lang: 'fr',
      } as unknown as ContactDto);
      expect(errors).toContain('lang');
    });

    it('should accept when lang is omitted (optional)', () => {
      const errors = violations({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'Hello there, this is a valid message.',
      } as ContactDto);
      expect(errors).not.toContain('lang');
    });
  });
});