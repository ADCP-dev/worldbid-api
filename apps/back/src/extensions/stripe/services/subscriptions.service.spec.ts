import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionEntity } from '../infrastructure/persistence/entities/subscription.entity';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let repo: jest.Mocked<Repository<SubscriptionEntity>>;

  const mockSubscription: SubscriptionEntity = {
    id: '1',
    stripeId: 'sub_test',
    userId: 1,
    planId: 'plan-1',
    plan: null as any,
    status: 'active',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    cancelAtPeriodEnd: false,
    trialEnd: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(SubscriptionEntity),
          useValue: {
            find: jest.fn().mockResolvedValue([mockSubscription]),
            findOne: jest.fn().mockResolvedValue(mockSubscription),
            create: jest.fn().mockReturnValue(mockSubscription),
            save: jest.fn().mockResolvedValue(mockSubscription),
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    repo = module.get(getRepositoryToken(SubscriptionEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all subscriptions with relations ordered DESC', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockSubscription]);
      expect(repo.find).toHaveBeenCalledWith({
        relations: ['plan', 'plan.price', 'plan.price.product'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findByUser', () => {
    it('should return subscriptions for a user with relations', async () => {
      const result = await service.findByUser(1);
      expect(result).toEqual([mockSubscription]);
      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        relations: ['plan', 'plan.price', 'plan.price.product'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findActiveByUser', () => {
    it('should return active subscription for user', async () => {
      const result = await service.findActiveByUser(1);
      expect(result).toEqual(mockSubscription);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: 1, status: 'active' },
        relations: ['plan', 'plan.price', 'plan.price.product'],
      });
    });

    it('should return null when no active subscription', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      const result = await service.findActiveByUser(999);
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return subscription by id with relations', async () => {
      const result = await service.findById('1');
      expect(result).toEqual(mockSubscription);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['plan', 'plan.price', 'plan.price.product'],
      });
    });

    it('should throw NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.findById('999')).rejects.toThrow(
        new NotFoundException('Subscription with ID 999 not found'),
      );
    });
  });

  describe('create', () => {
    it('should create a subscription with default status incomplete', async () => {
      const result = await service.create(1, { planId: 'plan-1' });
      expect(result).toEqual(mockSubscription);
      expect(repo.create).toHaveBeenCalledWith({
        userId: 1,
        planId: 'plan-1',
        status: 'incomplete',
      });
      expect(repo.save).toHaveBeenCalledWith(mockSubscription);
    });

    it('should create a subscription with provided status', async () => {
      await service.create(1, { planId: 'plan-1', status: 'active' });
      expect(repo.create).toHaveBeenCalledWith({
        userId: 1,
        planId: 'plan-1',
        status: 'active',
      });
    });
  });

  describe('cancel', () => {
    it('should cancel a subscription at period end', async () => {
      const result = await service.cancel('1');
      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(result.status).toBe('canceled');
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when subscription not found', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.cancel('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resume', () => {
    it('should resume a canceled subscription', async () => {
      const canceledSub = {
        ...mockSubscription,
        status: 'canceled',
        cancelAtPeriodEnd: true,
      };
      repo.findOne.mockResolvedValueOnce(canceledSub);
      repo.save.mockResolvedValueOnce({
        ...canceledSub,
        status: 'active',
        cancelAtPeriodEnd: false,
      });

      const result = await service.resume('1');
      expect(result.status).toBe('active');
      expect(result.cancelAtPeriodEnd).toBe(false);
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when subscription not found', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.resume('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update subscription status', async () => {
      const result = await service.updateStatus('1', 'past_due');
      expect(result.status).toBe('past_due');
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when subscription not found', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.updateStatus('999', 'active')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
