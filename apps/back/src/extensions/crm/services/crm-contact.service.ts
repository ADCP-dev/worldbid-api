import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmContactEntity } from '../infrastructure/persistence/entities/crm-contact.entity';
import { CreateContactDto } from '../dto/create-contact.dto';

@Injectable()
export class CrmContactService {
  private readonly logger = new Logger(CrmContactService.name);

  constructor(
    @InjectRepository(CrmContactEntity)
    private readonly repository: Repository<CrmContactEntity>,
  ) {}

  async findByClient(clientId: number): Promise<CrmContactEntity[]> {
    return this.repository.find({
      where: { clientId },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  async create(dto: CreateContactDto): Promise<CrmContactEntity> {
    const contact = this.repository.create(dto);
    const saved = await this.repository.save(contact);
    this.logger.log(`Created contact id=${saved.id} for client=${dto.clientId}`);
    return saved;
  }

  async update(id: number, dto: Partial<CreateContactDto>): Promise<CrmContactEntity> {
    const contact = await this.repository.findOne({ where: { id } });
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }
    Object.assign(contact, dto);
    const saved = await this.repository.save(contact);
    this.logger.log(`Updated contact id=${id}`);
    return saved;
  }

  async softDelete(id: number): Promise<void> {
    const contact = await this.repository.findOne({ where: { id } });
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }
    await this.repository.softDelete(id);
    this.logger.log(`Soft-deleted contact id=${id}`);
  }
}