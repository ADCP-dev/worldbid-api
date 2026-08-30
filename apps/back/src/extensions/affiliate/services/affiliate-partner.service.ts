import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, ILike, In } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import ms from 'ms';
import type { AllConfigType } from '@src/config/config.type';
import { AffiliatePartnerEntity } from '../infrastructure/persistence/entities/affiliate-partner.entity';
import { AffiliateReferralEntity } from '../infrastructure/persistence/entities/affiliate-referral.entity';
import { AffiliateCommissionEntity } from '../infrastructure/persistence/entities/affiliate-commission.entity';
import { CrmClientEntity } from '@ext/crm/infrastructure/persistence/entities/crm-client.entity';
import { CrmProjectEntity } from '@ext/crm/infrastructure/persistence/entities/crm-project.entity';
import { UserEntity } from '@users/infrastructure/entities/user.entity';
import { RoleEntity } from '@iam/roles/infrastructure/entities/role.entity';
import { RoleEnum } from '@iam/roles/roles.enum';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';
import { CreatePartnerDto } from '../dto/create-partner.dto';
import { UpdatePartnerDto } from '../dto/update-partner.dto';
import { CreatePartnerFromClientDto } from '../dto/create-partner-from-client.dto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

@Injectable()
export class AffiliatePartnerService {
  private readonly logger = new Logger(AffiliatePartnerService.name);

  constructor(
    @InjectRepository(AffiliatePartnerEntity)
    private readonly repository: Repository<AffiliatePartnerEntity>,
    @InjectRepository(AffiliateReferralEntity)
    private readonly referralRepository: Repository<AffiliateReferralEntity>,
    @InjectRepository(AffiliateCommissionEntity)
    private readonly commissionRepository: Repository<AffiliateCommissionEntity>,
    @InjectRepository(CrmClientEntity)
    private readonly clientRepository: Repository<CrmClientEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    private readonly mailerService: QueuedMailerService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async findAll(
    params: {
      page?: number;
      limit?: number;
      search?: string;
    } = {},
  ): Promise<{
    data: AffiliatePartnerEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, search } = params;

    const qb = this.repository
      .createQueryBuilder('partner')
      .loadRelationCountAndMap('partner.referralsCount', 'partner.referrals');

    if (search) {
      qb.andWhere([
        { name: ILike(`%${search}%`) },
        { email: ILike(`%${search}%`) },
        { code: ILike(`%${search}%`) },
      ]);
    }

    qb.orderBy('partner.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    this.logger.debug(
      `findAll: returned ${data.length} of ${total} partners (page ${page}, limit ${limit})`,
    );

    return { data, total, page, limit };
  }

  async findOne(id: number): Promise<AffiliatePartnerEntity> {
    const partner = await this.repository.findOne({
      where: { id },
      relations: ['referrals', 'referrals.client', 'referrals.commissions'],
    });
    if (!partner) {
      throw new NotFoundException(`Partner with ID ${id} not found`);
    }
    return partner;
  }

  async create(dto: CreatePartnerDto): Promise<AffiliatePartnerEntity> {
    const partner = this.repository.create(dto);
    partner.code = await this.generateUniqueCode();
    const saved = await this.repository.save(partner);
    this.logger.log(`Created partner id=${saved.id} code=${saved.code}`);
    return saved;
  }

  async update(
    id: number,
    dto: UpdatePartnerDto,
  ): Promise<AffiliatePartnerEntity> {
    const partner = await this.findOne(id);
    Object.assign(partner, dto);
    const saved = await this.repository.save(partner);
    this.logger.log(`Updated partner id=${id}`);
    return saved;
  }

  async softDelete(id: number): Promise<void> {
    await this.findOne(id);
    await this.repository.softDelete(id);
    this.logger.log(`Soft-deleted partner id=${id}`);
  }

  /**
   * Convert an existing CRM client into an affiliate partner.
   * Idempotent: if the client is already a partner, the existing partner is returned.
   */
  async createFromClient(
    clientId: number,
    dto: CreatePartnerFromClientDto,
  ): Promise<{ partner: AffiliatePartnerEntity; created: boolean }> {
    const client = await this.clientRepository.findOne({
      where: { id: clientId },
    });
    if (!client) {
      throw new NotFoundException(`CRM client with ID ${clientId} not found`);
    }

    // Idempotency: client already linked?
    const existingByClient = await this.repository.findOne({
      where: { clientId },
    });
    if (existingByClient) {
      return { partner: existingByClient, created: false };
    }

    // Idempotency: email collision with another partner → link the client to it
    const existingByEmail = await this.repository.findOne({
      where: { email: client.email ?? '' },
    });
    if (existingByEmail) {
      if (!existingByEmail.clientId) {
        existingByEmail.clientId = clientId;
        await this.repository.save(existingByEmail);
        this.logger.log(
          `Linked existing partner id=${existingByEmail.id} to CRM client id=${clientId}`,
        );
      }
      return { partner: existingByEmail, created: false };
    }

    if (!client.email) {
      throw new BadRequestException(
        'CRM client has no email address; cannot create a partner',
      );
    }

    if (dto.commissionRate === undefined) {
      throw new BadRequestException('commissionRate is required');
    }

    const partner = this.repository.create({
      clientId,
      name: client.name,
      email: client.email,
      companyName: client.companyName ?? null,
      phone: client.phone ?? null,
      commissionRate: dto.commissionRate,
      isActive: true,
      metadata: { source: 'crm', crmClientId: clientId },
    });
    partner.code = await this.generateUniqueCode();
    const saved = await this.repository.save(partner);
    this.logger.log(
      `Created partner id=${saved.id} code=${saved.code} from CRM client id=${clientId}`,
    );

    if (dto.invite !== false) {
      try {
        await this.invite(saved.id);
      } catch (err) {
        this.logger.error(
          `Invite failed for partner id=${saved.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return { partner: saved, created: true };
  }

  /**
   * Invite a partner: create (or reuse) a user account with role=affiliate,
   * link it to the partner, and email a time-limited set-password link
   * (reuses the reset-password JWT flow; no plaintext passwords).
   */
  async invite(id: number): Promise<AffiliatePartnerEntity> {
    const partner = await this.findOne(id);

    if (partner.userId) {
      throw new ConflictException(
        `Partner ${id} already has an associated user (userId=${partner.userId})`,
      );
    }

    let user = await this.userRepository.findOne({
      where: { email: partner.email },
    });

    if (!user) {
      const affiliateRole = await this.roleRepository.findOne({
        where: { id: RoleEnum.affiliate },
      });

      // Random unusable password — access is granted via the set-password link.
      const unusablePassword = randomBytes(32).toString('base64url');
      const hashedPassword = await bcrypt.hash(unusablePassword, 10);

      user = this.userRepository.create({
        email: partner.email,
        password: hashedPassword,
        firstName: partner.name,
        provider: 'email',
        role: affiliateRole ?? undefined,
      });
      user = await this.userRepository.save(user);
      this.logger.log(`Created user id=${user.id} for partner id=${id}`);
    } else {
      this.logger.warn(
        `User with email ${partner.email} already exists (id=${user.id}), linking to partner id=${id}`,
      );
    }

    partner.userId = user.id;
    const saved = await this.repository.save(partner);

    const setPasswordUrl = await this.buildSetPasswordUrl(user.id);

    try {
      await this.mailerService.sendMail({
        to: partner.email,
        subject: 'Welcome to the Affiliate Program',
        templateName: 'welcome',
        config: {
          partnerName: partner.name,
          subject: 'Welcome to the Affiliate Program',
          greeting: `Hello ${partner.name},`,
          bodyText:
            'You have been invited to the affiliate program. Create your password to access the portal:',
          link: setPasswordUrl,
          buttonText: 'Access the portal',
          email: partner.email,
          lang: 'en',
        },
        text: `Hello ${partner.name},\n\nYou have been invited to the affiliate program.\nCreate your password to access the portal:\n${setPasswordUrl}\n\nIf you did not expect this email, you can ignore it.`,
      } as never);
      this.logger.log(`Invitation email sent to ${partner.email}`);
    } catch (err) {
      this.logger.error(
        `Failed to send invitation email to ${partner.email}: ${err instanceof Error ? err.message : err}`,
      );
    }

    return saved;
  }

  /**
   * Full traceability pipeline for one partner (colaborador):
   * referral → client → projects → commissions per referral, plus totals.
   * Powers the admin partner detail and the affiliate self-service portal.
   */
  async getPipeline(partnerId: number): Promise<{
    partner: Pick<AffiliatePartnerEntity, 'id' | 'name' | 'email' | 'code' | 'companyName' | 'commissionRate'>;
    lines: Array<{
      referralId: number;
      clientId: number;
      clientName: string;
      companyName: string | null;
      referralStatus: string;
      referredAt: string | null;
      projects: Array<{
        projectId: number;
        projectName: string;
        projectStatus: string | null;
        paymentStatus: string | null;
        price: number | null;
        commission: {
          id: number;
          status: string;
          amount: number;
          baseAmount: number;
          rate: number;
          paidAt: string | null;
        } | null;
      }>;
      billedTotal: number;
      commissionTotal: number;
    }>;
    totals: {
      referrals: number;
      converted: number;
      billed: number;
      pending: number;
      approved: number;
      paid: number;
    };
  }> {
    const partner = await this.findOne(partnerId);

    const referrals = await this.referralRepository.find({
      where: { partnerId },
      order: { referredAt: 'DESC' },
    });

    const clientIds = [...new Set(referrals.map((r) => r.clientId))];
    const [clients, commissions] = await Promise.all([
      clientIds.length
        ? this.clientRepository.find({ where: { id: In(clientIds) } })
        : Promise.resolve([] as CrmClientEntity[]),
      this.commissionRepository.find({
        where: { referral: { partnerId } },
        relations: ['project'],
      }),
    ]);

    const clientsById = new Map(clients.map((c) => [c.id, c]));
    const commissionsByReferral = new Map<number, AffiliateCommissionEntity[]>();
    for (const c of commissions) {
      const list = commissionsByReferral.get(c.referralId) ?? [];
      list.push(c);
      commissionsByReferral.set(c.referralId, list);
    }

    let billed = 0;
    let pending = 0;
    let approved = 0;
    let paid = 0;
    let converted = 0;

    const lines = referrals.map((referral) => {
      const client = clientsById.get(referral.clientId);
      const referralCommissions = commissionsByReferral.get(referral.id) ?? [];

      const projects = referralCommissions.map((c) => {
        const price = Number((c.project as CrmProjectEntity | null)?.price ?? 0);
        const amount = Number(c.commissionAmount ?? 0);
        billed += price;
        if (c.status === 'pending') pending += amount;
        else if (c.status === 'approved') approved += amount;
        else if (c.status === 'paid') paid += amount;
        return {
          projectId: c.projectId,
          projectName: (c.project as CrmProjectEntity | null)?.name ?? `#${c.projectId}`,
          projectStatus: (c.project as CrmProjectEntity | null)?.status ?? null,
          paymentStatus: (c.project as CrmProjectEntity | null)?.paymentStatus ?? null,
          price,
          commission: {
            id: c.id,
            status: c.status,
            amount,
            baseAmount: Number(c.baseAmount ?? 0),
            rate: Number(c.commissionRate ?? 0),
            paidAt: c.paidAt?.toISOString?.() ?? null,
          },
        };
      });

      if (referral.status === 'converted') converted += 1;

      return {
        referralId: referral.id,
        clientId: referral.clientId,
        clientName: client?.name ?? `#${referral.clientId}`,
        companyName: client?.companyName ?? null,
        referralStatus: referral.status,
        referredAt: referral.referredAt?.toISOString?.() ?? null,
        projects,
        billedTotal: projects.reduce((acc, p) => acc + p.price, 0),
        commissionTotal: projects.reduce(
          (acc, p) => acc + (p.commission?.amount ?? 0),
          0,
        ),
      };
    });

    return {
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        code: partner.code,
        companyName: partner.companyName,
        commissionRate: partner.commissionRate,
      },
      lines,
      totals: {
        referrals: referrals.length,
        converted,
        billed,
        pending,
        approved,
        paid,
      },
    };
  }

  /**
   * Build a time-limited frontend set-password URL reusing the auth
   * forgot-password token flow (same JWT secret + TTL config as self-service).
   */
  private async buildSetPasswordUrl(userId: number): Promise<string> {
    const tokenExpiresIn = this.configService.getOrThrow('auth.forgotExpires', {
      infer: true,
    });
    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const hash = await this.jwtService.signAsync(
      { forgotUserId: userId },
      {
        secret: this.configService.getOrThrow('auth.forgotSecret', {
          infer: true,
        }),
        expiresIn: tokenExpiresIn,
      },
    );

    const frontendDomain = this.configService.getOrThrow('app.frontendDomain', {
      infer: true,
    });
    const url = new URL(`${frontendDomain}/password-change`);
    url.searchParams.set('hash', hash);
    url.searchParams.set('expires', tokenExpires.toString());
    return url.toString();
  }

  /** Generate a unique public code such as AFF-4K7TQ2 (no ambiguous characters). */
  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      let suffix = '';
      for (let i = 0; i < 6; i++) {
        suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      }
      const code = `AFF-${suffix}`;
      const collision = await this.repository.findOne({ where: { code } });
      if (!collision) {
        return code;
      }
    }
    throw new ConflictException(
      'Could not generate a unique partner code after 5 attempts',
    );
  }
}
