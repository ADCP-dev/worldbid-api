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
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    partnerId?: number;
    status?: string;
  } = {}): Promise<{
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
      throw new NotFoundException(
        `Partner with ID ${dto.partnerId} not found`,
      );
    }

    // Verify client exists
    const client = await this.clientRepository.findOne({
      where: { id: dto.clientId },
    });
    if (!client) {
      throw new NotFoundException(`Client with ID ${dto.clientId} not found`);
    }

    // Ensure the client isn't already referred
    const existing = await this.repository.findOne({
      where: { clientId: dto.clientId },
    });
    if (existing) {
      throw new BadRequestException(
        `Client ${dto.clientId} already has a referral`,
      );
    }

    let origin: CrmOriginEntity | null = null;

    if (dto.originId) {
      origin = await this.originRepository.findOne({
        where: { id: dto.originId },
      });
      if (!origin) {
        throw new NotFoundException(
          `Origin with ID ${dto.originId} not found`,
        );
      }
    } else {
      // Auto-create an origin of type=affiliate using shared logic
      const partner = await this.partnerRepository.findOne({
        where: { id: dto.partnerId },
      });
      // partner is already validated above, but we need it for name
      origin = await this.findOrCreateAffiliateOrigin(dto.partnerId, partner?.name ?? `Partner ${dto.partnerId}`);
    }

    const referral = this.repository.create({
      partnerId: dto.partnerId,
      clientId: dto.clientId,
      originId: origin?.id ?? null,
      status: dto.status ?? 'pending',
      metadata: dto.metadata ?? {},
    });
    const saved = await this.repository.save(referral);
    this.logger.log(
      `Created referral id=${saved.id} for partner id=${dto.partnerId}, client id=${dto.clientId}`,
    );

    // Update crm_client.origin_id
    if (origin) {
      client.originId = origin.id;
      await this.clientRepository.save(client);
      this.logger.debug(
        `Updated client id=${client.id} originId=${origin.id}`,
      );
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