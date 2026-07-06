import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';
import { CrmClientEntity } from '../infrastructure/persistence/entities/crm-client.entity';
import { CreateClientDto } from '../dto/create-client.dto';
import { UpdateClientDto } from '../dto/update-client.dto';

@Injectable()
export class CrmClientService {
  private readonly logger = new Logger(CrmClientService.name);

  constructor(
    @InjectRepository(CrmClientEntity)
    private readonly repository: Repository<CrmClientEntity>,
  ) {}

  async findAll(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      statusId?: number;
      originId?: number;
      sort?: string;
      order?: 'ASC' | 'DESC';
    } = {},
  ): Promise<{
    data: CrmClientEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      search,
      statusId,
      originId,
      sort = 'createdAt',
      order = 'DESC',
    } = params;

    const where: FindOptionsWhere<CrmClientEntity> = {};

    if (statusId) {
      where.statusId = statusId;
    }
    if (originId) {
      where.originId = originId;
    }

    const qb = this.repository.createQueryBuilder('client');

    qb.where(where);

    if (search) {
      qb.andWhere([
        { name: ILike(`%${search}%`) },
        { companyName: ILike(`%${search}%`) },
        { email: ILike(`%${search}%`) },
        { phone: ILike(`%${search}%`) },
        { nif: ILike(`%${search}%`) },
      ]);
    }

    const ALLOWED_SORT_COLUMNS = [
      'id',
      'name',
      'companyName',
      'email',
      'phone',
      'city',
      'createdAt',
      'updatedAt',
    ];
    const safeSort = ALLOWED_SORT_COLUMNS.includes(sort) ? sort : 'createdAt';
    qb.orderBy(`client.${safeSort}`, order);
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    this.logger.debug(
      `findAll: returned ${data.length} of ${total} clients (page ${page}, limit ${limit})`,
    );

    return { data, total, page, limit };
  }

  async findOne(id: number): Promise<CrmClientEntity> {
    const client = await this.repository.findOne({
      where: { id },
      relations: ['contacts', 'interactions', 'projects', 'status', 'origin'],
    });
    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
    return client;
  }

  async create(dto: CreateClientDto): Promise<CrmClientEntity> {
    const client = this.repository.create(dto);
    const saved = await this.repository.save(client);
    this.logger.log(`Created client id=${saved.id}`);
    return saved;
  }

  async update(id: number, dto: UpdateClientDto): Promise<CrmClientEntity> {
    const client = await this.findOne(id);
    Object.assign(client, dto);
    const saved = await this.repository.save(client);
    this.logger.log(`Updated client id=${id}`);
    return saved;
  }

  async softDelete(id: number): Promise<void> {
    await this.findOne(id);
    await this.repository.softDelete(id);
    this.logger.log(`Soft-deleted client id=${id}`);
  }
}
