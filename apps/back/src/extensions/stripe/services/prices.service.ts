import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceEntity } from '../infrastructure/persistence/entities/price.entity';
import { CreatePriceDto } from '../dto/create-price.dto';

@Injectable()
export class PricesService {
  constructor(
    @InjectRepository(PriceEntity)
    private readonly priceRepository: Repository<PriceEntity>,
  ) {}

  async findByProduct(productId: string): Promise<PriceEntity[]> {
    return this.priceRepository.find({
      where: { productId, active: true },
      relations: ['product'],
    });
  }

  async create(dto: CreatePriceDto): Promise<PriceEntity> {
    const price = this.priceRepository.create(dto);
    return this.priceRepository.save(price);
  }

  async update(id: string, dto: Partial<CreatePriceDto>): Promise<PriceEntity> {
    const price = await this.priceRepository.findOne({ where: { id } });
    if (!price) {
      throw new NotFoundException(`Price with ID ${id} not found`);
    }
    Object.assign(price, dto);
    return this.priceRepository.save(price);
  }
}
