import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionEntity } from '../infrastructure/persistence/entities/subscription.entity';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepository: Repository<SubscriptionEntity>,
  ) {}

  async findAll(): Promise<SubscriptionEntity[]> {
    return this.subscriptionRepository.find({
      relations: ['plan', 'plan.price', 'plan.price.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: number): Promise<SubscriptionEntity[]> {
    return this.subscriptionRepository.find({
      where: { userId },
      relations: ['plan', 'plan.price', 'plan.price.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveByUser(userId: number): Promise<SubscriptionEntity | null> {
    return this.subscriptionRepository.findOne({
      where: {
        userId,
        status: 'active',
      },
      relations: ['plan', 'plan.price', 'plan.price.product'],
    });
  }

  async findById(id: string): Promise<SubscriptionEntity> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id },
      relations: ['plan', 'plan.price', 'plan.price.product'],
    });
    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }
    return subscription;
  }

  async create(
    userId: number,
    dto: CreateSubscriptionDto,
  ): Promise<SubscriptionEntity> {
    const subscription = this.subscriptionRepository.create({
      userId,
      planId: dto.planId,
      status: dto.status ?? 'incomplete',
    });
    return this.subscriptionRepository.save(subscription);
  }

  async cancel(id: string): Promise<SubscriptionEntity> {
    const subscription = await this.findById(id);
    subscription.cancelAtPeriodEnd = true;
    subscription.status = 'canceled';
    return this.subscriptionRepository.save(subscription);
  }

  async resume(id: string): Promise<SubscriptionEntity> {
    const subscription = await this.findById(id);
    subscription.cancelAtPeriodEnd = false;
    subscription.status = 'active';
    return this.subscriptionRepository.save(subscription);
  }

  async updateStatus(id: string, status: string): Promise<SubscriptionEntity> {
    const VALID_STATUSES = ['active', 'past_due', 'canceled', 'incomplete', 'trialing'];
    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }
    const subscription = await this.findById(id);
    subscription.status = status;
    return this.subscriptionRepository.save(subscription);
  }
}
