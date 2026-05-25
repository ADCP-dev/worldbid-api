import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PlanEntity } from '../infrastructure/persistence/entities/plan.entity';

describe('PlansService', () => {
  let service: PlansService;
  let repo: jest.Mocked<Repository<PlanEntity>>;

  const mockPlan: PlanEntity = {
    id: '1',
    name: 'Pro',
    description: 'Pro plan',
    priceId: 'price-1',
    price: null as any,
    maxUsers: 10,
    maxStorage: 10737418240,
    features: ['api_access', 'priority_support'],
    isDefault: true,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        {
          provide: getRepositoryToken(PlanEntity),
          useValue: {
            find: jest.fn().mockResolvedValue([mockPlan]),
            findOne: jest.fn().mockResolvedValue(mockPlan),
            create: jest.fn().mockReturnValue(mockPlan),
            save: jest.fn().mockResolvedValue(mockPlan),
          },
        },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
    repo = module.get(getRepositoryToken(PlanEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all active plans ordered by createdAt DESC with relations', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockPlan]);
      expect(repo.find).toHaveBeenCalledWith({
        where: { active: true },
        relations: ['price', 'price.product'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findById', () => {
    it('should return a plan by id with relations', async () => {
      const result = await service.findById('1');
      expect(result).toEqual(mockPlan);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['price', 'price.product'],
      });
    });

    it('should throw NotFoundException when plan not found', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.findById('999')).rejects.toThrow(
        new NotFoundException('Plan with ID 999 not found'),
      );
    });
  });

  describe('findDefault', () => {
    it('should return the default active plan with relations', async () => {
      const result = await service.findDefault();
      expect(result).toEqual(mockPlan);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { isDefault: true, active: true },
        relations: ['price', 'price.product'],
      });
    });

    it('should return null when no default plan exists', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      const result = await service.findDefault();
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create and save a new plan', async () => {
      const dto = {
        name: 'Pro',
        description: 'Pro',
        priceId: 'price-1',
        maxUsers: 10,
      };
      const result = await service.create(dto);
      expect(result).toEqual(mockPlan);
      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(repo.save).toHaveBeenCalledWith(mockPlan);
    });
  });

  describe('update', () => {
    it('should update a plan and save it', async () => {
      const dto = { name: 'Updated' };
      const result = await service.update('1', dto);
      expect(result.name).toBe('Updated');
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when plan not found', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.update('999', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
