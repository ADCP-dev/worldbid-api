import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AffiliateReferralEntity } from '../infrastructure/persistence/entities/affiliate-referral.entity';
import { AffiliatePartnerEntity } from '../infrastructure/persistence/entities/affiliate-partner.entity';
import { CrmClientEntity } from '@ext/crm/infrastructure/persistence/entities/crm-client.entity';
import { CrmOriginEntity } from '@ext/crm/infrastructure/persistence/entities/crm-origin.entity';
import { CrmStatusEntity } from '@ext/crm/infrastructure/persistence/entities/crm-status.entity';
import { CreateReferralDto } from '../dto/create-referral.dto';
import { UpdateReferralDto } from '../dto/update-referral.dto';

const VALID_STATUSES = ['pending', 'converted', 'rejected'];

@Injectable()
export class AffiliateReferralService {
  private readonly logger = new Logger(AffiliateReferralService.name);

  constructor(
    @InjectRepository(AffiliateReferralEntity)
    private readonly repository: Repository<AffiliateReferralEntity>,
    @InjectRepository(AffiliatePartnerEntity)
    private readonly partnerRepository: Repository<AffiliatePartnerEntity>,
    @InjectRepository(CrmClientEntity)
    private readonly clientRepository: Repository<CrmClientEntity>,
    @InjectRepository(CrmOriginEntity)
    private readonly originRepository: Repository<CrmOriginEntity>,
    @InjectRepository(CrmStatusEntity)
    private readonly statusRepository: Repository<CrmStatusEntity>,
  ) {}

  async findAll(
    params: {
      page?: number;
      limit?: number;
      partnerId?: number;
      status?: string;
    } = {},
  ): Promise<{
    data: AffiliateReferralEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, partnerId, status } = params;

    const qb = this.repository.createQueryBuilder('referral');
    qb.leftJoinAndSelect('referral.partner', 'partner');
    qb.leftJoinAndSelect('referral.client', 'client');
    qb.leftJoinAndSelect('referral.origin', 'origin');

    if (partnerId) {
      qb.andWhere('referral.partnerId = :partnerId', { partnerId });
    }
    if (status) {
      qb.andWhere('referral.status = :status', { status });
    }

    qb.orderBy('referral.referredAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    this.logger.debug(
      `findAll: returned ${data.length} of ${total} referrals (page ${page}, limit ${limit})`,
    );

    return { data, total, page, limit };
  }

  async findOne(id: number): Promise<AffiliateReferralEntity> {
    const referral = await this.repository.findOne({
      where: { id },
      relations: ['partner', 'client', 'origin', 'commissions'],
    });
    if (!referral) {
      throw new NotFoundException(`Referral with ID ${id} not found`);
    }
    return referral;
  }

  async create(dto: CreateReferralDto): Promise<AffiliateReferralEntity> {
    // Verify partner exists
    const partner = await this.partnerRepository.findOne({
      where: { id: dto.partnerId },
    });
    if (!partner) {
      throw new NotFoundException(`Partner with ID ${dto.partnerId} not found`);
    }

    // Exactly one of clientId | newClient must be provided
    if (!dto.clientId && !dto.newClient) {
      throw new BadRequestException(
        'Provide either clientId or newClient data',
      );
    }

    // Ensure the target client isn't already referred (existing or inline)
    if (dto.clientId) {
      const existing = await this.repository.findOne({
        where: { clientId: dto.clientId },
      });
      if (existing) {
        throw new BadRequestException(
          `Client ${dto.clientId} already has a referral`,
        );
      }
    } else if (dto.newClient) {
      const existingByEmail = await this.clientRepository.findOne({
        where: { email: dto.newClient.email },
      });
      if (existingByEmail) {
        const alreadyReferred = await this.repository.findOne({
          where: { clientId: existingByEmail.id },
        });
        if (alreadyReferred) {
          throw new BadRequestException(
            `Client with email ${dto.newClient.email} already has a referral`,
          );
        }
        // Reuse the existing client instead of duplicating it
        dto.clientId = existingByEmail.id;
        dto.newClient = undefined;
      }
    }

    let origin: CrmOriginEntity | null = null;

    if (dto.originId) {
      origin = await this.originRepository.findOne({
        where: { id: dto.originId },
      });
      if (!origin) {
        throw new NotFoundException(`Origin with ID ${dto.originId} not found`);
      }
    } else {
      // Auto-create an origin of type=affiliate using shared logic
      origin = await this.findOrCreateAffiliateOrigin(
        dto.partnerId,
        partner?.name ?? `Partner ${dto.partnerId}`,
      );
    }

    // Inline client creation path (admin registers the client right here)
    if (dto.newClient) {
      const defaultStatus = await this.statusRepository.findOne({
        where: { isDefault: true },
      });
      const leadStatus = await this.statusRepository.findOne({
        where: { name: 'lead' },
      });
      const statusId = defaultStatus?.id ?? leadStatus?.id ?? 1;

      const saved = await this.clientRepository.manager.transaction(
        async (manager) => {
          const client = manager.create(CrmClientEntity, {
            name: dto.newClient!.name,
            email: dto.newClient!.email,
            companyName: dto.newClient!.companyName ?? null,
            phone: dto.newClient!.phone ?? null,
            statusId,
            originId: origin?.id ?? null,
            originDetail: `Affiliate referral from ${partner.name}`,
            metadata: {
              source: 'affiliate_admin',
              partner_id: dto.partnerId,
              ...(dto.metadata ?? {}),
            },
            isActive: true,
          });
          const savedClient = await manager.save(client);

          const referral = manager.create(AffiliateReferralEntity, {
            partnerId: dto.partnerId,
            clientId: savedClient.id,
            originId: origin?.id ?? null,
            status: dto.status ?? 'pending',
            metadata: dto.metadata ?? {},
          });
          const savedReferral = await manager.save(referral);
          this.logger.log(
            `Created referral id=${savedReferral.id} for partner id=${dto.partnerId} with inline client id=${savedClient.id}`,
          );
          return savedReferral;
        },
      );
      return saved;
    }

    const clientId = dto.clientId as number;

    // Verify client exists
    const client = await this.clientRepository.findOne({
      where: { id: clientId },
    });
    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    const referral = this.repository.create({
      partnerId: dto.partnerId,
      clientId,
      originId: origin?.id ?? null,
      status: dto.status ?? 'pending',
      metadata: dto.metadata ?? {},
    });

    const saved = await this.clientRepository.manager.transaction(
      async (manager) => {
        const savedReferral = await manager.save(referral);
        if (origin) {
          client.originId = origin.id;
          await manager.save(client);
        }
        return savedReferral;
      },
    );

    this.logger.log(
      `Created referral id=${saved.id} for partner id=${dto.partnerId}, client id=${clientId}`,
    );

    if (origin) {
      this.logger.debug(`Updated client id=${client.id} originId=${origin.id}`);
    }

    return saved;
  }

  async update(
    id: number,
    dto: UpdateReferralDto,
  ): Promise<AffiliateReferralEntity> {
    const referral = await this.findOne(id);

    if (dto.status) {
      if (!VALID_STATUSES.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid status '${dto.status}'. Valid values: ${VALID_STATUSES.join(', ')}`,
        );
      }
      referral.status = dto.status;
    }
    if (dto.metadata) {
      referral.metadata = { ...referral.metadata, ...dto.metadata };
    }

    const saved = await this.repository.save(referral);
    this.logger.log(`Updated referral id=${id}, status=${saved.status}`);
    return saved;
  }

  async delete(id: number): Promise<void> {
    const referral = await this.findOne(id);
    await this.repository.remove(referral);
    this.logger.log(`Hard-deleted referral id=${id}`);
  }

  /**
   * Shared helper: find or create an affiliate origin for a partner.
   * Mirrors AffiliatePortalService.findOrCreateAffiliateOrigin.
   */
  private async findOrCreateAffiliateOrigin(
    partnerId: number,
    partnerName: string,
  ): Promise<CrmOriginEntity> {
    const originName = `affiliate-partner-${partnerId}`;
    let origin = await this.originRepository.findOne({
      where: { name: originName },
    });
    if (!origin) {
      origin = this.originRepository.create({
        name: originName,
        label: `Affiliate: ${partnerName}`,
        type: 'affiliate',
        isActive: true,
        sortOrder: 100,
        metadata: { partner_id: partnerId },
      });
      origin = await this.originRepository.save(origin);
      this.logger.log(
        `Auto-created affiliate origin id=${origin.id} for partner id=${partnerId}`,
      );
    } else {
      const meta = (origin.metadata ?? {}) as Record<string, unknown>;
      if (meta.partner_id !== partnerId) {
        meta.partner_id = partnerId;
        origin.metadata = meta;
        await this.originRepository.save(origin);
      }
    }
    return origin;
  }
}
