import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeService } from './stripe.service';
import { UsersService } from '@users/users.service';
import { SubscriptionEntity } from '../infrastructure/persistence/entities/subscription.entity';
import { PriceEntity } from '../infrastructure/persistence/entities/price.entity';
import { PlanEntity } from '../infrastructure/persistence/entities/plan.entity';
import { AllConfigType } from '@src/config/config.type';

describe('StripeService', () => {
  let service: StripeService;
  let stripeMock: any;
  let usersServiceMock: any;
  let subscriptionRepoMock: jest.Mocked<Repository<SubscriptionEntity>>;
  let priceRepoMock: jest.Mocked<Repository<PriceEntity>>;
  let planRepoMock: jest.Mocked<Repository<PlanEntity>>;

  const createModule = async (stripe: any | null) => {
    return Test.createTestingModule({
      providers: [
        StripeService,
        { provide: 'STRIPE', useValue: stripe },
        {
          provide: ConfigService<AllConfigType>,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'stripe') {
                return { frontendDomain: 'http://localhost:3000' };
              }
              return undefined;
            }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SubscriptionEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn().mockReturnValue({}),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PriceEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PlanEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();
  };

  beforeEach(async () => {
    stripeMock = {
      customers: {
        create: jest.fn().mockResolvedValue({ id: 'cus_new' }),
        retrieve: jest.fn(),
      },
      prices: {
        list: jest.fn(),
      },
      checkout: {
        sessions: {
          create: jest.fn(),
        },
      },
      billingPortal: {
        sessions: {
          create: jest.fn(),
        },
      },
      subscriptions: {
        cancel: jest.fn(),
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    };

    const module = await createModule(stripeMock);
    service = module.get(StripeService);
    usersServiceMock = module.get(UsersService);
    subscriptionRepoMock = module.get(getRepositoryToken(SubscriptionEntity));
    priceRepoMock = module.get(getRepositoryToken(PriceEntity));
    planRepoMock = module.get(getRepositoryToken(PlanEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrRetrieveCustomer', () => {
    it('should return existing customerId when user already has stripeCustomerId', async () => {
      const user = {
        id: 1,
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
        stripeCustomerId: 'cus_existing',
      };
      usersServiceMock.findById.mockResolvedValue(user as any);

      const result = await service.createOrRetrieveCustomer(1);

      expect(result).toBe('cus_existing');
      expect(stripeMock.customers.create).not.toHaveBeenCalled();
    });

    it('should create new customer when user has no stripeCustomerId', async () => {
      const user = {
        id: 1,
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
        stripeCustomerId: null,
      };
      usersServiceMock.findById.mockResolvedValue(user as any);
      stripeMock.customers.create.mockResolvedValue({ id: 'cus_new' });

      const result = await service.createOrRetrieveCustomer(1);

      expect(result).toBe('cus_new');
      expect(stripeMock.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@test.com',
          metadata: { userId: '1' },
        }),
      );
      expect(usersServiceMock.update).toHaveBeenCalledWith(1, {
        stripeCustomerId: 'cus_new',
      });
    });

    it('should throw when user not found', async () => {
      usersServiceMock.findById.mockResolvedValue(null as any);

      await expect(service.createOrRetrieveCustomer(1)).rejects.toThrow(
        'User with id 1 not found',
      );
    });

    it('should throw when Stripe is not configured', async () => {
      const module = await createModule(null);
      const unconfiguredService = module.get(StripeService);

      await expect(
        unconfiguredService.createOrRetrieveCustomer(1),
      ).rejects.toThrow('Stripe is not configured');
    });
  });

  describe('createCheckoutSessionForUser', () => {
    it('should create checkout session successfully', async () => {
      const user = {
        id: 1,
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
        stripeCustomerId: 'cus_1',
      };
      usersServiceMock.findById.mockResolvedValue(user as any);
      stripeMock.prices.list.mockResolvedValue({
        data: [{ id: 'price_1' }],
      });
      stripeMock.checkout.sessions.create.mockResolvedValue({ id: 'cs_1' });

      const result = await service.createCheckoutSessionForUser(
        1,
        'key_monthly',
      );

      expect(result).toEqual({ id: 'cs_1' });
      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          customer: 'cus_1',
        }),
      );
    });

    it('should throw when user not found', async () => {
      usersServiceMock.findById.mockResolvedValue(null as any);

      await expect(
        service.createCheckoutSessionForUser(1, 'key'),
      ).rejects.toThrow('User not found');
    });

    it('should throw when price lookup key not found', async () => {
      const user = {
        id: 1,
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
        stripeCustomerId: 'cus_1',
      };
      usersServiceMock.findById.mockResolvedValue(user as any);
      stripeMock.prices.list.mockResolvedValue({ data: [] });

      await expect(
        service.createCheckoutSessionForUser(1, 'key'),
      ).rejects.toThrow('Price with lookup key key not found');
    });

    it('should throw when Stripe not configured', async () => {
      const module = await createModule(null);
      const unconfiguredService = module.get(StripeService);

      await expect(
        unconfiguredService.createCheckoutSessionForUser(1, 'key'),
      ).rejects.toThrow('Stripe is not configured');
    });
  });

  describe('createCustomerPortalSession', () => {
    it('should return portal URL', async () => {
      stripeMock.billingPortal.sessions.create.mockResolvedValue({
        url: 'https://billing.stripe.com/session/test',
      });

      const result = await service.createCustomerPortalSession('cus_1');

      expect(result.url).toBe('https://billing.stripe.com/session/test');
    });

    it('should throw on API error', async () => {
      stripeMock.billingPortal.sessions.create.mockRejectedValue(
        new Error('API error'),
      );

      await expect(
        service.createCustomerPortalSession('cus_1'),
      ).rejects.toThrow('API error');
    });

    it('should throw when Stripe not configured', async () => {
      const module = await createModule(null);
      const unconfiguredService = module.get(StripeService);

      await expect(
        unconfiguredService.createCustomerPortalSession('cus_1'),
      ).rejects.toThrow('Stripe is not configured');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel successfully', async () => {
      stripeMock.subscriptions.cancel.mockResolvedValue({
        id: 'sub_1',
        status: 'canceled',
      });

      const result = await service.cancelSubscription('sub_1');

      expect(result.status).toBe('canceled');
      expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith('sub_1');
    });

    it('should throw on API error', async () => {
      stripeMock.subscriptions.cancel.mockRejectedValue(
        new Error('Cancel failed'),
      );

      await expect(service.cancelSubscription('sub_1')).rejects.toThrow(
        'Cancel failed',
      );
    });

    it('should throw when Stripe not configured', async () => {
      const module = await createModule(null);
      const unconfiguredService = module.get(StripeService);

      await expect(
        unconfiguredService.cancelSubscription('sub_1'),
      ).rejects.toThrow('Stripe is not configured');
    });
  });

  describe('constructWebhookEvent', () => {
    it('should return parsed event with valid signature', () => {
      const payload = Buffer.from('test');
      const signature = 'sig';
      const secret = 'whsec_test';
      const event = { type: 'test' };
      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      const result = service.constructWebhookEvent(payload, signature, secret);

      expect(result).toEqual(event);
      expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        secret,
      );
    });

    it('should throw on invalid signature', () => {
      const payload = Buffer.from('test');
      const signature = 'bad_sig';
      const secret = 'whsec_test';
      stripeMock.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() =>
        service.constructWebhookEvent(payload, signature, secret),
      ).toThrow('Invalid signature');
    });

    it('should throw when Stripe not configured', async () => {
      const module = await createModule(null);
      const unconfiguredService = module.get(StripeService);

      expect(() =>
        unconfiguredService.constructWebhookEvent(
          Buffer.from(''),
          'sig',
          'sec',
        ),
      ).toThrow('Stripe is not configured');
    });
  });

  describe('handleWebhookEvent', () => {
    it('should create local SubscriptionEntity on customer.subscription.created', async () => {
      const now = Math.floor(Date.now() / 1000);
      const stripeSub = {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        items: {
          data: [
            {
              price: 'price_stripe_1',
              current_period_start: now,
              current_period_end: now + 86400,
            },
          ],
        },
        cancel_at_period_end: false,
        trial_end: null,
      };

      stripeMock.customers.retrieve.mockResolvedValue({
        id: 'cus_1',
        deleted: false,
        metadata: { userId: '1' },
      });

      priceRepoMock.findOne.mockResolvedValue({
        id: 'price_local_1',
        stripeId: 'price_stripe_1',
      } as PriceEntity);
      planRepoMock.findOne.mockResolvedValue({
        id: 'plan_1',
        priceId: 'price_local_1',
      } as PlanEntity);
      subscriptionRepoMock.findOne.mockResolvedValue(null);
      subscriptionRepoMock.create.mockReturnValue({} as SubscriptionEntity);
      subscriptionRepoMock.save.mockResolvedValue({
        id: 'local_sub_1',
      } as SubscriptionEntity);

      await service.handleWebhookEvent({
        type: 'customer.subscription.created',
        data: { object: stripeSub },
      } as any);

      expect(subscriptionRepoMock.save).toHaveBeenCalled();
    });

    it('should update status and period dates on customer.subscription.updated', async () => {
      const now = Math.floor(Date.now() / 1000);
      const stripeSub = {
        id: 'sub_1',
        status: 'past_due',
        items: {
          data: [
            {
              current_period_start: now,
              current_period_end: now + 86400,
            },
          ],
        },
        cancel_at_period_end: true,
        trial_end: null,
      };

      const existingEntity = {
        id: 'local_sub_1',
        stripeId: 'sub_1',
        status: 'active',
      } as SubscriptionEntity;

      subscriptionRepoMock.findOne.mockResolvedValue(existingEntity);
      subscriptionRepoMock.save.mockResolvedValue(existingEntity);

      await service.handleWebhookEvent({
        type: 'customer.subscription.updated',
        data: { object: stripeSub },
      } as any);

      expect(subscriptionRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'past_due',
          cancelAtPeriodEnd: true,
        }),
      );
    });

    it('should set status to canceled on customer.subscription.deleted', async () => {
      const existingEntity = {
        id: 'local_sub_1',
        stripeId: 'sub_1',
        status: 'active',
      } as SubscriptionEntity;

      subscriptionRepoMock.findOne.mockResolvedValue(existingEntity);
      subscriptionRepoMock.save.mockResolvedValue(existingEntity);

      await service.handleWebhookEvent({
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_1' } },
      } as any);

      expect(subscriptionRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'canceled',
          cancelAtPeriodEnd: true,
        }),
      );
    });

    it('should log but not crash on unhandled event types', async () => {
      const loggerSpy = jest
        .spyOn((service as any).logger, 'log')
        .mockImplementation(() => {});

      await service.handleWebhookEvent({
        type: 'invoice.payment_succeeded',
        data: { object: {} },
      } as any);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Unhandled event type: invoice.payment_succeeded',
      );
      loggerSpy.mockRestore();
    });

    it('should log warning and not crash when Stripe not configured', async () => {
      const module = await createModule(null);
      const unconfiguredService = module.get(StripeService);
      const loggerSpy = jest
        .spyOn((unconfiguredService as any).logger, 'warn')
        .mockImplementation(() => {});

      await unconfiguredService.handleWebhookEvent({ type: 'test' } as any);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Received webhook event but Stripe is not configured',
      );
      loggerSpy.mockRestore();
    });
  });
});
