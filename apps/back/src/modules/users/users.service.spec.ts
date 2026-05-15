import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '@users/users.service';
import { UserRepository } from '@users/infrastructure/user.repository';
import { FilesService } from '@storage/files/files.service';
import { ImageProcessingService } from '@storage/files/infrastructure/image-processing/image-processing.service';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from '@users/dto/create-user.dto';

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
        {
          provide: 'FILE_UPLOADER_SERVICE',
          useValue: {
            upload: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: ImageProcessingService,
          useValue: {
            process: jest.fn(),
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
    it('should create a user when email is available', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        password: 'password',
        firstName: 'John',
        lastName: 'Doe',
      };

      const createdUser = { id: 'uuid-1', email: 'test@example.com' };
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);
      jest
        .spyOn(userRepository, 'create')
        .mockResolvedValue(createdUser as any);

      const result = await service.create(createUserDto);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(userRepository.create).toHaveBeenCalled();
      expect(result).toEqual(createdUser);
    });
  });
});
