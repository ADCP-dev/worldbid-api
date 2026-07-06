import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmStatusEntity } from '../infrastructure/persistence/entities/crm-status.entity';
import { CrmClientEntity } from '../infrastructure/persistence/entities/crm-client.entity';
import { CreateStatusDto } from '../dto/create-status.dto';
import { UpdateStatusDto } from '../dto/update-status.dto';

@Injectable()
export class CrmStatusService {
  private readonly logger = new Logger(CrmStatusService.name);

  constructor(
    @InjectRepository(CrmStatusEntity)
    private readonly repository: Repository<CrmStatusEntity>,
    @InjectRepository(CrmClientEntity)
    private readonly clientRepository: Repository<CrmClientEntity>,
  ) {}

  async findAll(): Promise<CrmStatusEntity[]> {
    return this.repository.find({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async create(dto: CreateStatusDto): Promise<CrmStatusEntity> {
    const status = this.repository.create(dto);
    const saved = await this.repository.save(status);
    this.logger.log(`Created status id=${saved.id} name=${saved.name}`);
    return saved;
  }

  async update(id: number, dto: UpdateStatusDto): Promise<CrmStatusEntity> {
    const status = await this.repository.findOne({ where: { id } });
    if (!status) {
      throw new NotFoundException(`Status with ID ${id} not found`);
    }
    Object.assign(status, dto);
    const saved = await this.repository.save(status);
    this.logger.log(`Updated status id=${id}`);
    return saved;
  }

  async delete(id: number): Promise<void> {
    const status = await this.repository.findOne({ where: { id } });
    if (!status) {
      throw new NotFoundException(`Status with ID ${id} not found`);
    }

    // Check if status is in use by any client
    const inUse = await this.clientRepository.count({
      where: { statusId: id },
    });
    if (inUse > 0) {
      throw new BadRequestException(
        `Status with ID ${id} is in use by ${inUse} client(s) and cannot be deleted`,
      );
    }

    await this.repository.delete(id);
    this.logger.log(`Deleted status id=${id}`);
  }
}
