import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { PlanGuard, RequiredFeature, FEATURE_KEY } from './plan-guard';
import { SubscriptionsService } from '../services/subscriptions.service';
import { PlansService } from '../services/plans.service';

describe('PlanGuard', () => {
  let guard: PlanGuard;
  let reflector: jest.Mocked<Reflector>;
  let subscriptionsService: any;
  let plansService: any;

  const createExecutionContext = (user?: any): Partial<ExecutionContext> =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: SubscriptionsService,
          useValue: {
            findActiveByUser: jest.fn(),
          },
        },
        {
          provide: PlansService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get(PlanGuard);
    reflector = module.get(Reflector);
    subscriptionsService = module.get(SubscriptionsService);
    plansService = module.get(PlansService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access when no @RequiredFeature decorator is present', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createExecutionContext({ id: 1 }) as ExecutionContext;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has required feature', async () => {
      reflector.getAllAndOverride.mockReturnValue('api_access');
      subscriptionsService.findActiveByUser.mockResolvedValue({
        planId: 'plan_1',
      } as any);
      plansService.findById.mockResolvedValue({
        features: ['api_access', 'priority_support'],
      } as any);

      const context = createExecutionContext({ id: 1 }) as ExecutionContext;
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(subscriptionsService.findActiveByUser).toHaveBeenCalledWith(1);
      expect(plansService.findById).toHaveBeenCalledWith('plan_1');
    });

    it('should deny access when user lacks required feature', async () => {
      reflector.getAllAndOverride.mockReturnValue('premium_feature');
      subscriptionsService.findActiveByUser.mockResolvedValue({
        planId: 'plan_1',
      } as any);
      plansService.findById.mockResolvedValue({
        features: ['api_access'],
      } as any);

      const context = createExecutionContext({ id: 1 }) as ExecutionContext;
      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should deny access when user has no active subscription', async () => {
      reflector.getAllAndOverride.mockReturnValue('api_access');
      subscriptionsService.findActiveByUser.mockResolvedValue(null);

      const context = createExecutionContext({ id: 1 }) as ExecutionContext;
      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should deny access when user is not authenticated', async () => {
      reflector.getAllAndOverride.mockReturnValue('api_access');
      const context = createExecutionContext(undefined) as ExecutionContext;

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should deny access when plan lookup throws', async () => {
      reflector.getAllAndOverride.mockReturnValue('api_access');
      subscriptionsService.findActiveByUser.mockResolvedValue({
        planId: 'plan_1',
      } as any);
      plansService.findById.mockRejectedValue(new Error('DB error'));

      const context = createExecutionContext({ id: 1 }) as ExecutionContext;
      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });
  });

  describe('@RequiredFeature decorator', () => {
    it('should set metadata correctly on method', () => {
      const decorator = RequiredFeature('test_feature');
      const target = {};
      const key = 'methodName';
      const descriptor = { value: jest.fn() };

      decorator(target, key, descriptor);

      expect(Reflect.getMetadata(FEATURE_KEY, descriptor.value)).toBe(
        'test_feature',
      );
    });
  });
});
