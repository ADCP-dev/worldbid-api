import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { StripeService } from './stripe.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let stripeServiceMock: jest.Mocked<Partial<StripeService>>;

  beforeEach(async () => {
    stripeServiceMock = {
      handleWebhookEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: StripeService,
          useValue: stripeServiceMock,
        },
      ],
    }).compile();

    service = module.get(WebhooksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should delegate handleEvent to stripeService.handleWebhookEvent', async () => {
    const event = { type: 'customer.subscription.created' } as any;

    await service.handleEvent(event);

    expect(stripeServiceMock.handleWebhookEvent).toHaveBeenCalledWith(event);
    expect(stripeServiceMock.handleWebhookEvent).toHaveBeenCalledTimes(1);
  });
});
