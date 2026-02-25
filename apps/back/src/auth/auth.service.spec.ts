import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { SessionService } from '../session/session.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import {
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { User } from '../users/domain/user';
import { RoleEnum } from '../roles/roles.enum';
import { AuthProvidersEnum } from './auth-providers.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let sessionService: SessionService;
  let jwtService: JwtService;
  let mailService: MailService;
  let configService: ConfigService;

  let mockUser: User;
  let mockSession: any;

  beforeEach(async () => {
    mockUser = {
      id: 1,
      email: 'test@example.com',
      password: 'hashedPassword',
      provider: AuthProvidersEnum.email,
      role: { id: RoleEnum.customer, name: 'User' },
      status: { id: StatusEnum.active, name: 'Active' },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: new Date(),
      firstName: 'John',
      lastName: 'Doe',
    };

    mockSession = {
      id: 1,
      user: mockUser,
      hash: 'oldHash',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: new Date(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findById: jest.fn(),
            findBySocialIdAndProvider: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            deleteById: jest.fn(),
            deleteByUserId: jest.fn(),
            deleteByUserIdWithExclude: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            userSignUp: jest.fn(),
            forgotPassword: jest.fn(),
            confirmNewEmail: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              switch (key) {
                case 'auth.expires':
                  return '15m';
                case 'auth.secret':
                  return 'secret';
                case 'auth.refreshSecret':
                  return 'refreshSecret';
                case 'auth.refreshExpires':
                  return '7d';
                case 'auth.confirmEmailSecret':
                  return 'confirmEmailSecret';
                case 'auth.confirmEmailExpires':
                  return '1h';
                case 'auth.forgotSecret':
                  return 'forgotSecret';
                case 'auth.forgotExpires':
                  return '1h';
                default:
                  return null;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    sessionService = module.get<SessionService>(SessionService);
    jwtService = module.get<JwtService>(JwtService);
    mailService = module.get<MailService>(MailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateLogin', () => {
    it('should return login response on successful login', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
      jest.spyOn(sessionService, 'create').mockResolvedValue(mockSession as any);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('token');

      const result = await service.validateLogin({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });

    it('should throw UnprocessableEntityException if user not found', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

      await expect(
        service.validateLogin({
          email: 'notfound@example.com',
          password: 'password',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException if provider is not email', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue({
        ...mockUser,
        provider: AuthProvidersEnum.google,
      });

      await expect(
        service.validateLogin({
          email: 'test@example.com',
          password: 'password',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException if password does not match', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

      await expect(
        service.validateLogin({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('validateSocialLogin', () => {
    it('should login existing user with social provider', async () => {
      jest.spyOn(usersService, 'findBySocialIdAndProvider').mockResolvedValue(mockUser);
      jest.spyOn(sessionService, 'create').mockResolvedValue(mockSession as any);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('token');

      const result = await service.validateSocialLogin('google', {
        id: 'socialId',
        email: 'test@example.com',
      });

      expect(result).toHaveProperty('token');
      expect(usersService.update).toHaveBeenCalled();
    });

    it('should create new user if not found', async () => {
      jest.spyOn(usersService, 'findBySocialIdAndProvider').mockResolvedValue(null);
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(usersService, 'create').mockResolvedValue(mockUser);
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(sessionService, 'create').mockResolvedValue(mockSession as any);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('token');

      const result = await service.validateSocialLogin('google', {
        id: 'newSocialId',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
      });

      expect(result).toHaveProperty('token');
      expect(usersService.create).toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should register a new user and send confirmation email', async () => {
      jest.spyOn(usersService, 'create').mockResolvedValue({
          ...mockUser,
          status: { id: StatusEnum.inactive, name: 'Inactive' }
      });
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('hash');

      await service.register({
        email: 'new@example.com',
        password: 'password',
        firstName: 'New',
        lastName: 'User',
      });

      expect(usersService.create).toHaveBeenCalled();
      expect(mailService.userSignUp).toHaveBeenCalledWith({
        to: 'new@example.com',
        data: { hash: 'hash' },
      });
    });
  });

  describe('confirmEmail', () => {
    it('should confirm email and activate user', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ confirmEmailUserId: 1 });
      jest.spyOn(usersService, 'findById').mockResolvedValue({
        ...mockUser,
        status: { id: StatusEnum.inactive, name: 'Inactive' },
      });

      await service.confirmEmail('validHash');

      expect(usersService.update).toHaveBeenCalledWith(1, expect.objectContaining({
        status: { id: StatusEnum.active },
      }));
    });

    it('should throw UnprocessableEntityException on invalid hash', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(new Error());

      await expect(service.confirmEmail('invalidHash')).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ confirmEmailUserId: 999 });
      jest.spyOn(usersService, 'findById').mockResolvedValue(null);

      await expect(service.confirmEmail('validHash')).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmNewEmail', () => {
    it('should update email and activate user', async () => {
        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
            confirmEmailUserId: 1,
            newEmail: 'new@example.com'
        });
        jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);

        await service.confirmNewEmail('validHash');

        expect(usersService.update).toHaveBeenCalledWith(1, expect.objectContaining({
            email: 'new@example.com',
            status: { id: StatusEnum.active },
        }));
    });
  });

  describe('forgotPassword', () => {
    it('should send forgot password email', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('hash');

      await service.forgotPassword('test@example.com');

      expect(mailService.forgotPassword).toHaveBeenCalled();
    });

    it('should throw UnprocessableEntityException if email not found', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

      await expect(service.forgotPassword('unknown@example.com')).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('resetPassword', () => {
    it('should reset password', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ forgotUserId: 1 });
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);

      await service.resetPassword('validHash', 'newPassword');

      expect(usersService.update).toHaveBeenCalled();
      expect(sessionService.deleteByUserId).toHaveBeenCalledWith({ userId: 1 });
    });
  });

  describe('update', () => {
    it('should update user profile', async () => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(usersService, 'update').mockResolvedValue(mockUser);

      const result = await service.update(
        { id: 1, sessionId: 1, iat: 1, exp: 1 },
        { firstName: 'Updated' },
      );

      expect(usersService.update).toHaveBeenCalledWith(1, expect.objectContaining({ firstName: 'Updated' }));
      expect(result).toEqual(mockUser);
    });

    it('should update password', async () => {
        jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);
        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

        await service.update(
            { id: 1, sessionId: 1, iat: 1, exp: 1 },
            { password: 'newPassword', oldPassword: 'hashedPassword' },
        );

        expect(sessionService.deleteByUserIdWithExclude).toHaveBeenCalled();
        expect(usersService.update).toHaveBeenCalled();
    });

    it('should send confirmation email on email change', async () => {
        jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);
        jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
        jest.spyOn(jwtService, 'signAsync').mockResolvedValue('hash');

        await service.update(
            { id: 1, sessionId: 1, iat: 1, exp: 1 },
            { email: 'new@example.com' },
        );

        expect(mailService.confirmNewEmail).toHaveBeenCalled();
        expect(usersService.update).toHaveBeenCalled(); // Should be called without email first
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens', async () => {
      jest.spyOn(sessionService, 'findById').mockResolvedValue(mockSession as any);
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('newToken');

      const result = await service.refreshToken({ sessionId: 1, hash: 'oldHash' });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(sessionService.update).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if session not found', async () => {
      jest.spyOn(sessionService, 'findById').mockResolvedValue(null);

      await expect(service.refreshToken({ sessionId: 1, hash: 'hash' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete session', async () => {
      await service.logout({ sessionId: 1 });
      expect(sessionService.deleteById).toHaveBeenCalledWith(1);
    });
  });

  describe('softDelete', () => {
    it('should soft delete user', async () => {
      await service.softDelete(mockUser);
      expect(usersService.remove).toHaveBeenCalledWith(mockUser.id);
    });
  });
});
