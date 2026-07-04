import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmInteractionEntity } from '../infrastructure/persistence/entities/crm-interaction.entity';
import { CreateInteractionDto } from '../dto/create-interaction.dto';
import { UpdateInteractionDto } from '../dto/update-interaction.dto';

@Injectable()
export class CrmInteractionService {
  private readonly logger = new Logger(CrmInteractionService.name);

  constructor(
    @InjectRepository(CrmInteractionEntity)
    private readonly repository: Repository<CrmInteractionEntity>,
  ) {}

  async findByClient(
    clientId: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: CrmInteractionEntity[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.repository.findAndCount({
      where: { clientId },
      order: { interactionDate: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['contact'],
    });
    return { data, total, page, limit };
  }

  async create(dto: CreateInteractionDto): Promise<CrmInteractionEntity> {
    const interaction = this.repository.create(dto);
    const saved = await this.repository.save(interaction);
    this.logger.log(
      `Created interaction id=${saved.id} for client=${dto.clientId}`,
    );
    return saved;
  }

  async update(
    id: number,
    dto: UpdateInteractionDto,
  ): Promise<CrmInteractionEntity> {
    const interaction = await this.repository.findOne({ where: { id } });
    if (!interaction) {
      throw new NotFoundException(`Interaction with ID ${id} not found`);
    }
    Object.assign(interaction, dto);
    const saved = await this.repository.save(interaction);
    this.logger.log(`Updated interaction id=${id}`);
    return saved;
  }

  async delete(id: number): Promise<void> {
    const interaction = await this.repository.findOne({ where: { id } });
    if (!interaction) {
      throw new NotFoundException(`Interaction with ID ${id} not found`);
    }
    await this.repository.delete(id);
    this.logger.log(`Deleted interaction id=${id}`);
  }
}