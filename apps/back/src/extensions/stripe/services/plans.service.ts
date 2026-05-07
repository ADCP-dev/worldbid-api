import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanEntity } from '../infrastructure/persistence/entities/plan.entity';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,
  ) {}

  async findAll(): Promise<PlanEntity[]> {
    return this.planRepository.find({
      where: { active: true },
      relations: ['price', 'price.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<PlanEntity> {
    const plan = await this.planRepository.findOne({
      where: { id },
      relations: ['price', 'price.product'],
    });
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
    return plan;
  }

  async create(dto: CreatePlanDto): Promise<PlanEntity> {
    const plan = this.planRepository.create(dto);
    return this.planRepository.save(plan);
  }

  async update(id: string, dto: UpdatePlanDto): Promise<PlanEntity> {
    const plan = await this.findById(id);
    Object.assign(plan, dto);
    return this.planRepository.save(plan);
  }

  async findDefault(): Promise<PlanEntity | null> {
    return this.planRepository.findOne({
      where: { isDefault: true, active: true },
      relations: ['price', 'price.product'],
    });
  }
}
