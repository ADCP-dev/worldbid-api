import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { FilesService } from '../files/files.service';
import { ConfigService } from '@nestjs/config';
import { UnprocessableEntityException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: UserRepository;
  let filesService: FilesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UserRepository,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: FilesService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get<UserRepository>(UserRepository);
    filesService = module.get<FilesService>(FilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw UnprocessableEntityException when photo does not exist', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        password: 'password',
        firstName: 'John',
        lastName: 'Doe',
        photo: {
          id: 'non-existing-id',
          path: '',
          isPublic: true,
          type: 'image',
          size: 0,
        },
      };

      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(filesService, 'findById').mockResolvedValue(null);

      await expect(service.create(createUserDto)).rejects.toThrow(
        UnprocessableEntityException,
      );

      try {
        await service.create(createUserDto);
      } catch (e: any) {
        expect(e).toBeInstanceOf(UnprocessableEntityException);
        expect(e.getResponse()).toEqual({
          status: 422,
          errors: {
            photo: 'imageNotExists',
          },
        });
      }
    });
  });
});
