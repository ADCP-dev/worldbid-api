import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AffiliatePartnerEntity } from '../infrastructure/persistence/entities/affiliate-partner.entity';
import { UserEntity } from '@users/infrastructure/entities/user.entity';
import { RoleEntity } from '@iam/roles/infrastructure/entities/role.entity';
import { RoleEnum } from '@iam/roles/roles.enum';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';
import { CreatePartnerDto } from '../dto/create-partner.dto';
import { UpdatePartnerDto } from '../dto/update-partner.dto';

@Injectable()
export class AffiliatePartnerService {
  private readonly logger = new Logger(AffiliatePartnerService.name);

  constructor(
    @InjectRepository(AffiliatePartnerEntity)
    private readonly repository: Repository<AffiliatePartnerEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    private readonly mailerService: QueuedMailerService,
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

    const qb = this.repository.createQueryBuilder('partner');

    if (search) {
      qb.andWhere([
        { name: ILike(`%${search}%`) },
        { email: ILike(`%${search}%`) },
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
    const saved = await this.repository.save(partner);
    this.logger.log(`Created partner id=${saved.id}`);
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
   * Invite a partner: create a user with role=affiliate, link it to the partner,
   * and send a reset-password / welcome email.
   */
  async invite(id: number): Promise<AffiliatePartnerEntity> {
    const partner = await this.findOne(id);

    if (partner.userId) {
      throw new BadRequestException(
        `Partner ${id} already has an associated user (userId=${partner.userId})`,
      );
    }

    // Check if a user with that email already exists
    let user = await this.userRepository.findOne({
      where: { email: partner.email },
    });

    let tempPassword: string | null = null;

    if (!user) {
      const affiliateRole = await this.roleRepository.findOne({
        where: { id: RoleEnum.affiliate },
      });

      tempPassword = randomBytes(12).toString('base64url').slice(0, 16);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

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

    // Send welcome / reset email
    try {
      const passwordSection =
        tempPassword !== null
          ? `<p>Your temporary password is: <strong>${tempPassword}</strong></p>
<p>Please log in and change your password immediately.</p>`
          : `<p>You can log in with your existing credentials.</p>`;

      await this.mailerService.sendMail({
        to: partner.email,
        subject: 'Welcome to the Affiliate Program',
        html: `<p>Hello ${partner.name},</p>
<p>You have been invited to the affiliate program. You can now log in to the portal.</p>
<p>Email: ${partner.email}</p>
${passwordSection}`,
        text: `Hello ${partner.name},\n\nYou have been invited to the affiliate program. You can now log in to the portal.\nEmail: ${partner.email}${
          tempPassword !== null
            ? `\n\nYour temporary password is: ${tempPassword}\nPlease log in and change your password immediately.`
            : ''
        }`,
      });
      this.logger.log(`Invitation email sent to ${partner.email}`);
    } catch (err) {
      this.logger.error(
        `Failed to send invitation email to ${partner.email}: ${err?.message ?? err}`,
      );
    }

    return saved;
  }
}
