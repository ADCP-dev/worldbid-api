import {
  Controller,
  Post,
  Body,
  Get,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

/**
 * Entorno de pruebas de pagos con Stripe.
 * Simula el comportamiento real de Stripe según el número de tarjeta usado.
 */
@ApiTags('Stripe Test')
@Controller({
  path: 'stripe/test',
  version: '1',
})
export class StripeTestController {
  private testPayments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    description: string;
    cardLast4: string;
    cardBrand: string;
    error?: string;
    createdAt: Date;
  }> = [];

  /**
   * Validación de tarjetas de prueba (igual que Stripe test mode)
   */
  private validateCard(card: { number: string; expiry: string; cvc: string }) {
    const clean = card.number.replace(/\s/g, '');

    // Tarjetas que siempre funcionan
    const successCards: Record<string, { brand: string; last4: string }> = {
      '4242424242424242': { brand: 'Visa', last4: '4242' },
      '5555555555554444': { brand: 'Mastercard', last4: '4444' },
      '378282246310005': { brand: 'American Express', last4: '0005' },
      '6011111111111117': { brand: 'Discover', last4: '1117' },
    };

    // Tarjetas que fallan
    const declineCards: Record<string, string> = {
      '4000000000000002': 'Tarjeta rechazada',
      '4000000000009995': 'Fondos insuficientes',
      '4000000000009987': 'Tarjeta perdida o robada',
      '4000000000009979': 'Sospecha de fraude',
      '4000000000000069': 'Tarjeta caducada',
      '4000000000000127': 'CVC incorrecto',
      '4000000000000119': 'Error de procesamiento',
    };

    // Tarjetas que requieren 3D Secure
    const threeDSecureCards = ['4000000000003220', '4000000000003063'];

    if (successCards[clean]) {
      return { success: true, ...successCards[clean] };
    }

    if (declineCards[clean]) {
      return { success: false, error: declineCards[clean] };
    }

    if (threeDSecureCards.includes(clean)) {
      return {
        success: false,
        error:
          'Se requiere autenticación 3D Secure. Usa la URL de redirección.',
        threeDSecure: true,
      };
    }

    // Tarjeta desconocida → falla genérica
    return {
      success: false,
      error: 'Tarjeta no válida o no soportada en modo test',
    };
  }

  @Post('payment')
  @ApiOperation({ summary: 'Simular un pago con validación de tarjeta' })
  createTestPayment(
    @Body()
    body: {
      amount: number;
      currency?: string;
      description?: string;
      card?: { number: string; expiry: string; cvc: string; name?: string };
    },
  ) {
    const card = body.card || {
      number: '4242424242424242',
      expiry: '12/28',
      cvc: '123',
    };
    const validation = this.validateCard(card);

    const payment: any = {
      id: `pi_test_${Date.now()}`,
      amount: body.amount ?? 1000,
      currency: body.currency ?? 'eur',
      description: body.description ?? 'Test payment',
      cardLast4: (validation as any).last4 || card.number.slice(-4),
      cardBrand: (validation as any).brand || 'Unknown',
      createdAt: new Date(),
    };

    if (validation.success) {
      payment.status = 'succeeded';
      this.testPayments.unshift(payment);
      return payment;
    }

    if ((validation as any).threeDSecure) {
      payment.status = 'requires_action';
      payment.nextAction = {
        type: 'redirect_to_url',
        redirectToUrl: 'https://hooks.stripe.com/3d_secure_2/redirect/test',
      };
      this.testPayments.unshift(payment);
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: validation.error,
          payment,
          requiresAction: true,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    payment.status = 'failed';
    payment.error = validation.error;
    this.testPayments.unshift(payment);

    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message: validation.error,
        payment,
        declineCode: 'card_declined',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  @Get('payments')
  @ApiOperation({ summary: 'Listar pagos de prueba' })
  listTestPayments() {
    return this.testPayments;
  }

  @Post('subscription')
  @ApiOperation({ summary: 'Simular creación de suscripción' })
  createTestSubscription(
    @Body() body: { planId?: string; customerEmail?: string },
  ) {
    return {
      id: `sub_test_${Date.now()}`,
      status: 'active',
      planId: body.planId ?? 'plan_free',
      customerEmail: body.customerEmail ?? 'test@example.com',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      message: 'Suscripción de prueba creada correctamente',
    };
  }

  @Post('webhook/simulate')
  @ApiOperation({ summary: 'Simular evento de webhook' })
  simulateWebhook(
    @Body() body: { type: string; data?: Record<string, unknown> },
  ) {
    const eventTypes = [
      'checkout.session.completed',
      'invoice.paid',
      'invoice.payment_failed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ];

    return {
      id: `evt_test_${Date.now()}`,
      type: body.type ?? 'checkout.session.completed',
      data: body.data ?? { object: 'event' },
      created: Math.floor(Date.now() / 1000),
      validTypes: eventTypes,
      message: 'Evento simulado. En producción vendría firmado por Stripe.',
    };
  }

  @Get('methods')
  @ApiOperation({ summary: 'Ver métodos de pago disponibles (test)' })
  listPaymentMethods() {
    return {
      methods: [
        { id: 'pm_card_visa', brand: 'Visa', last4: '4242' },
        { id: 'pm_card_mastercard', brand: 'Mastercard', last4: '5555' },
        { id: 'pm_card_amex', brand: 'American Express', last4: '0005' },
        { id: 'pm_card_visa_debit', brand: 'Visa Debit', last4: '4000' },
      ],
      testCards: [
        {
          number: '4242 4242 4242 4242',
          brand: 'Visa',
          result: 'Pago exitoso',
        },
        {
          number: '4000 0000 0000 0002',
          brand: 'Visa',
          result: 'Pago rechazado',
        },
        {
          number: '4000 0000 0000 3220',
          brand: 'Visa',
          result: 'Requiere 3D Secure',
        },
      ],
      message: 'Usa estas tarjetas en modo test de Stripe',
    };
  }
}
