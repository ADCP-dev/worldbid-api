import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { StripeTestController } from './stripe-test.controller';

describe('StripeTestController', () => {
  let controller: StripeTestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeTestController],
    }).compile();

    controller = module.get<StripeTestController>(StripeTestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTestPayment', () => {
    it('should succeed with valid Visa 4242', async () => {
      const result = await controller.createTestPayment({
        amount: 1000,
        currency: 'eur',
        description: 'Test',
        card: { number: '4242424242424242', expiry: '12/28', cvc: '123' },
      });
      expect(result.status).toBe('succeeded');
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe('eur');
      expect(result.cardBrand).toBe('Visa');
    });

    it('should succeed with valid Mastercard', async () => {
      const result = await controller.createTestPayment({
        amount: 2000,
        card: { number: '5555555555554444', expiry: '12/28', cvc: '123' },
      });
      expect(result.status).toBe('succeeded');
      expect(result.cardBrand).toBe('Mastercard');
    });

    it('should reject declined card', () => {
      expect(() =>
        controller.createTestPayment({
          amount: 1000,
          card: { number: '4000000000000002', expiry: '12/28', cvc: '123' },
        }),
      ).toThrow(HttpException);

      try {
        controller.createTestPayment({
          amount: 1000,
          card: { number: '4000000000000002', expiry: '12/28', cvc: '123' },
        });
      } catch (error: any) {
        expect(error.response.message).toContain('rechazada');
        expect(error.response.declineCode).toBe('card_declined');
      }
    });

    it('should reject insufficient funds card', () => {
      expect(() =>
        controller.createTestPayment({
          amount: 1000,
          card: { number: '4000000000009995', expiry: '12/28', cvc: '123' },
        }),
      ).toThrow(HttpException);

      try {
        controller.createTestPayment({
          amount: 1000,
          card: { number: '4000000000009995', expiry: '12/28', cvc: '123' },
        });
      } catch (error: any) {
        expect(error.response.message).toContain('Fondos');
      }
    });

    it('should require 3D Secure for specific cards', () => {
      expect(() =>
        controller.createTestPayment({
          amount: 1000,
          card: { number: '4000000000003220', expiry: '12/28', cvc: '123' },
        }),
      ).toThrow(HttpException);

      try {
        controller.createTestPayment({
          amount: 1000,
          card: { number: '4000000000003220', expiry: '12/28', cvc: '123' },
        });
      } catch (error: any) {
        expect(error.response.message).toContain('3D Secure');
        expect(error.response.requiresAction).toBe(true);
      }
    });

    it('should reject unknown cards', () => {
      expect(() =>
        controller.createTestPayment({
          amount: 1000,
          card: { number: '1234567890123456', expiry: '12/28', cvc: '123' },
        }),
      ).toThrow(HttpException);

      try {
        controller.createTestPayment({
          amount: 1000,
          card: { number: '1234567890123456', expiry: '12/28', cvc: '123' },
        });
      } catch (error: any) {
        expect(error.response.message).toContain('no válida');
      }
    });

    it('should use defaults when card not provided', async () => {
      const result = await controller.createTestPayment({ amount: 1000 });
      expect(result.status).toBe('succeeded');
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe('eur');
    });
  });

  describe('listTestPayments', () => {
    it('should return empty array initially', async () => {
      const ctrl = new StripeTestController();
      const result = await ctrl.listTestPayments();
      expect(result).toEqual([]);
    });

    it('should return payments after creating one', async () => {
      const ctrl = new StripeTestController();
      await ctrl.createTestPayment({
        amount: 1000,
        card: { number: '4242424242424242', expiry: '12/28', cvc: '123' },
      });
      const result = await ctrl.listTestPayments();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('succeeded');
    });
  });

  describe('simulateWebhook', () => {
    it('should return simulated webhook event', async () => {
      const result = await controller.simulateWebhook({
        type: 'checkout.session.completed',
      });
      expect(result.type).toBe('checkout.session.completed');
      expect(result.validTypes).toBeDefined();
      expect(Array.isArray(result.validTypes)).toBe(true);
    });
  });

  describe('listPaymentMethods', () => {
    it('should return test cards', async () => {
      const result = await controller.listPaymentMethods();
      expect(result.methods).toHaveLength(4);
      expect(result.testCards).toHaveLength(3);
    });
  });
});
