import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@iam/roles/roles.guard';
import { RoleEnum } from '@iam/roles/roles.enum';
import { WebhooksController } from '../controllers/webhooks.controller';
import { AccountController } from '../controllers/account.controller';
import { WebhooksService } from '../services/webhooks.service';
import { PlatformsService } from '../services/platforms.service';

describe('Upload-Post route guards (N1 — W2/W3 remediation)', () => {
  let reflector: Reflector;
  let webhooksCtrl: WebhooksController;
  let accountCtrl: AccountController;

  const handlerGuards = (instance: object, handler: string) =>
    Reflect.getMetadata(
      '__guards__',
      Object.getPrototypeOf(instance)[handler],
    ) as unknown[];

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WebhooksController, AccountController],
      providers: [
        { provide: WebhooksService, useValue: {} },
        { provide: PlatformsService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();
    reflector = moduleRef.get(Reflector);
    webhooksCtrl = moduleRef.get(WebhooksController);
    accountCtrl = moduleRef.get(AccountController);

    // AuthGuard('jwt') mixin must be constructible without a live strategy
    vi.spyOn(
      AuthGuard('jwt') as unknown as { constructor: () => void },
      'constructor',
    ).mockImplementation(() => undefined);
  });

  it('should require admin role on POST webhooks/configure', () => {
    const guards = handlerGuards(webhooksCtrl, 'configure');
    expect(guards).toContain(AuthGuard('jwt'));
    expect(guards).toContain(RolesGuard);
    expect(reflector.get<RoleEnum[]>('roles', webhooksCtrl.configure)).toEqual([
      RoleEnum.admin,
    ]);
  });

  it('should keep POST webhooks/incoming public (HMAC-validated) — no jwt guard', () => {
    expect(handlerGuards(webhooksCtrl, 'handleIncoming')).toBeUndefined();
    expect(
      reflector.get<RoleEnum[]>('roles', webhooksCtrl.handleIncoming),
    ).toBeUndefined();
  });

  it('should require admin role on GET upload-post/me (account health)', () => {
    const guards = handlerGuards(accountCtrl, 'me');
    expect(guards).toContain(AuthGuard('jwt'));
    expect(guards).toContain(RolesGuard);
    // Class-level @Roles — resolved by RolesGuard via getAllAndOverride
    expect(
      reflector.getAllAndOverride<RoleEnum[]>('roles', [
        accountCtrl.me,
        AccountController,
      ]),
    ).toEqual([RoleEnum.admin]);
  });
});
