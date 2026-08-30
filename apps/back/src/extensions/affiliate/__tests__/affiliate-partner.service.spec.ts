import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AffiliatePartnerService } from '../services/affiliate-partner.service';
import { AffiliatePartnerEntity } from '../../infrastructure/persistence/entities/affiliate-partner.entity';
import { CrmClientEntity } from '@ext/crm/infrastructure/persistence/entities/crm-client.entity';
import { AffiliateReferralEntity } from '../../infrastructure/persistence/entities/affiliate-referral.entity';
import { AffiliateCommissionEntity } from '../../infrastructure/persistence/entities/affiliate-commission.entity';
import { UserEntity } from '@users/infrastructure/entities/user.entity';
import { RoleEntity } from '@iam/roles/infrastructure/entities/role.entity';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';

describe('AffiliatePartnerService', () => {
  let service: AffiliatePartnerService;
  let partnerRepo: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let referralRepo: { find: ReturnType<typeof vi.fn> };
  let commissionRepo: { find: ReturnType<typeof vi.fn> };
  let clientRepo: { findOne: ReturnType<typeof vi.fn>; find: ReturnType<typeof vi.fn> };
  let userRepo: { findOne: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let roleRepo: { findOne: ReturnType<typeof vi.fn> };
  let mailer: { sendMail: ReturnType<typeof vi.fn> };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };

  const makePartner = (over: Partial<AffiliatePartnerEntity> = {}) =>
    ({
      id: 1,
      clientId: null,
      userId: null,
      name: 'John Doe',
      email: 'john@example.com',
      code: 'AFF-AAAAAA',
      commissionRate: 0.05,
      isActive: true,
      metadata: {},
      ...over,
    }) as AffiliatePartnerEntity;

  beforeEach(async () => {
    partnerRepo = {
      create: vi.fn((x) => x),
      save: vi.fn(async (x) => x),
      findOne: vi.fn(async () => null),
      createQueryBuilder: vi.fn(() => {
        const qb: Record<string, ReturnType<typeof vi.fn>> = {
          loadRelationCountAndMap: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          take: vi.fn().mockReturnThis(),
          getManyAndCount: vi.fn(async () => [[], 0]),
        };
        return qb;
      }),
      softDelete: vi.fn(async () => undefined),
    };
    referralRepo = {
      find: vi.fn(async () => []),
    };
    commissionRepo = {
      find: vi.fn(async () => []),
    };
    referralRepo = { find: vi.fn(async () => []) };
    commissionRepo = { find: vi.fn(async () => []) };
    clientRepo = { findOne: vi.fn(async () => null), find: vi.fn(async () => []) };
    userRepo = {
      findOne: vi.fn(async () => null),
      create: vi.fn((x) => x),
      save: vi.fn(async (x) => ({ id: 55, ...x })),
    };
    roleRepo = { findOne: vi.fn(async () => ({ id: 3 })) };
    mailer = { sendMail: vi.fn(async () => undefined) };
    jwt = { signAsync: vi.fn(async () => 'fake-token') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AffiliatePartnerService,
        { provide: 'AffiliatePartnerEntityRepository', useValue: partnerRepo },
        { provide: 'AffiliateReferralEntityRepository', useValue: referralRepo },
        { provide: 'AffiliateCommissionEntityRepository', useValue: commissionRepo },
        { provide: 'CrmClientEntityRepository', useValue: clientRepo },
        { provide: 'UserEntityRepository', useValue: userRepo },
        { provide: 'RoleEntityRepository', useValue: roleRepo },
        { provide: QueuedMailerService, useValue: mailer },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn((key: string) => {
              if (key === 'auth.forgotExpires') return '1d';
              if (key === 'auth.forgotSecret') return 'test-secret';
              if (key === 'app.frontendDomain') return 'https://app.test';
              throw new Error(`Unexpected key ${key}`);
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AffiliatePartnerService);
  });

  describe('create', () => {
    it('should generate a unique partner code on create', async () => {
      partnerRepo.save.mockImplementation(async (p) => p);
      const result = await service.create({ name: 'X', email: 'x@x.com' } as never);
      expect(result.code).toMatch(/^AFF-[A-Z2-9]{6}$/);
    });
  });

  describe('invite', () => {
    it('should create user, link partner, and email a set-password link without plaintext password', async () => {
      partnerRepo.findOne
        .mockResolvedValueOnce(makePartner()) // findOne relations (invite uses findOne)
        .mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.invite(1);

      expect(result.userId).toBe(55);
      expect(userRepo.save).toHaveBeenCalled();
      expect(mailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
          templateName: 'welcome',
        }),
      );
      const mailArg = mailer.sendMail.mock.calls[0][0];
      expect(mailArg.config.link).toContain('/password-change?hash=');
      expect(mailArg.config.passwordSection).toBeUndefined();
      expect(JSON.stringify(mailArg)).not.toContain('temporary password');
    });

    it('should throw ConflictException when partner already has a user', async () => {
      partnerRepo.findOne.mockResolvedValue(makePartner({ userId: 10 }));
      await expect(service.invite(1)).rejects.toBeInstanceOf(ConflictException);
    });
  });


  describe('getPipeline', () => {
    it('should build referral → project → commission lines with totals', async () => {
      partnerRepo.findOne.mockResolvedValue(makePartner({ id: 1 }));
      referralRepo.find.mockResolvedValue([
        { id: 10, partnerId: 1, clientId: 7, status: 'converted', referredAt: new Date('2026-01-10') },
        { id: 11, partnerId: 1, clientId: 8, status: 'pending', referredAt: new Date('2026-02-01') },
      ]);
      clientRepo.find.mockResolvedValue([
        { id: 7, name: 'Alice', companyName: 'Alice SL' },
        { id: 8, name: 'Bob', companyName: null },
      ]);
      commissionRepo.find.mockResolvedValue([
        {
          id: 100,
          referralId: 10,
          projectId: 50,
          status: 'approved',
          baseAmount: 1000,
          commissionRate: 0.05,
          commissionAmount: 50,
          paidAt: null,
          project: { id: 50, name: 'Web redesign', status: 'in_progress', paymentStatus: 'partial', price: 1000 },
        },
        {
          id: 101,
          referralId: 10,
          projectId: 51,
          status: 'paid',
          baseAmount: 500,
          commissionRate: 0.05,
          commissionAmount: 25,
          paidAt: new Date('2026-03-01'),
          project: { id: 51, name: 'Landing', status: 'delivered', paymentStatus: 'paid', price: 500 },
        },
      ]);

      const result = await service.getPipeline(1);

      expect(result.partner.id).toBe(1);
      expect(result.totals).toEqual({
        referrals: 2,
        converted: 1,
        billed: 1500,
        pending: 0,
        approved: 50,
        approved_total_unused: undefined,
        paid: 25,
      } as never);
      // First line = converted referral with 2 projects
      const line = result.lines.find((l) => l.referralId === 10) as never as {
        referralId: number;
        clientName: string;
        projects: Array<{ projectId: number; commission: { amount: number } | null }>;
        billedTotal: number;
        commissionTotal: number;
      };
      expect(line.clientName).toBe('Alice');
      expect(line.projects).toHaveLength(2);
      expect(line.projects[0].commission?.amount).toBe(50);
      expect(line.billedTotal).toBe(1500);
      expect(line.commissionTotal).toBe(75);
      // Second line: pending referral, no commissions → empty projects
      const empty = result.lines.find((l) => l.referralId === 11) as never as {
        projects: unknown[];
        billedTotal: number;
      };
      expect(empty.projects).toHaveLength(0);
      expect(empty.billedTotal).toBe(0);
    });
  });

  describe('createFromClient', () => {
    const client = {
      id: 7,
      name: 'Acme',
      email: 'billing@acme.com',
      companyName: 'Acme SL',
      phone: '+34600000000',
    };

    it('should create partner from CRM client + invite by default (idempotent by client)', async () => {
      clientRepo.findOne.mockResolvedValue(client);
      partnerRepo.save.mockImplementation(async (p) => ({ ...p, id: 9 }));
      const inviteSpy = vi
        .spyOn(service, 'invite')
        .mockResolvedValue(makePartner({ id: 9 }));

      const { partner, created } = await service.createFromClient(7, {
        commissionRate: 0.08,
      });

      expect(created).toBe(true);
      expect(partner.clientId).toBe(7);
      expect(partner.email).toBe('billing@acme.com');
      expect(inviteSpy).toHaveBeenCalledWith(9);
    });

    it('should return existing partner without creating when client already linked', async () => {
      clientRepo.findOne.mockResolvedValue(client);
      const existing = makePartner({ id: 3, clientId: 7 });
      partnerRepo.findOne.mockResolvedValue(existing);

      const { partner, created } = await service.createFromClient(7, {
        commissionRate: 0.08,
      });

      expect(created).toBe(false);
      expect(partner.id).toBe(3);
      expect(partnerRepo.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequest when CRM client has no email', async () => {
      clientRepo.findOne.mockResolvedValue({ ...client, email: null });
      await expect(
        service.createFromClient(7, { commissionRate: 0.08 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});