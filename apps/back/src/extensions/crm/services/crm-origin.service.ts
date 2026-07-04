import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmOriginEntity } from '../infrastructure/persistence/entities/crm-origin.entity';
import { CrmClientEntity } from '../infrastructure/persistence/entities/crm-client.entity';
import { CreateOriginDto } from '../dto/create-origin.dto';
import { UpdateOriginDto } from '../dto/update-origin.dto';

@Injectable()
export class CrmOriginService {
  private readonly logger = new Logger(CrmOriginService.name);

  constructor(
    @InjectRepository(CrmOriginEntity)
    private readonly repository: Repository<CrmOriginEntity>,
    @InjectRepository(CrmClientEntity)
    private readonly clientRepository: Repository<CrmClientEntity>,
  ) {}

  async findAll(): Promise<CrmOriginEntity[]> {
    return this.repository.find({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async create(dto: CreateOriginDto): Promise<CrmOriginEntity> {
    const origin = this.repository.create(dto);
    const saved = await this.repository.save(origin);
    this.logger.log(`Created origin id=${saved.id} name=${saved.name}`);
    return saved;
  }

  async update(id: number, dto: UpdateOriginDto): Promise<CrmOriginEntity> {
    const origin = await this.repository.findOne({ where: { id } });
    if (!origin) {
      throw new NotFoundException(`Origin with ID ${id} not found`);
    }
    Object.assign(origin, dto);
    const saved = await this.repository.save(origin);
    this.logger.log(`Updated origin id=${id}`);
    return saved;
  }

  async delete(id: number): Promise<void> {
    const origin = await this.repository.findOne({ where: { id } });
    if (!origin) {
      throw new NotFoundException(`Origin with ID ${id} not found`);
    }

    // Check if origin is in use by any client
    const inUse = await this.clientRepository.count({
      where: { originId: id },
    });
    if (inUse > 0) {
      throw new BadRequestException(
        `Cannot delete origin ${id}: ${inUse} clients are using it`,
      );
    }

    await this.repository.delete(id);
    this.logger.log(`Deleted origin id=${id}`);
  }
}