import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from '@users/dto/create-user.dto';
import { NullableType } from '@infra/utils/types/nullable.type';
import { UserRepository } from '@users/infrastructure/user.repository';
import { User } from '@users/domain/user';
import bcrypt from 'bcryptjs';
import { AuthProvidersEnum } from '@iam/auth/auth-providers.enum';
import { FilesService } from '@storage/files/files.service';
import { RoleEnum } from '@iam/roles/roles.enum';
import { StatusEnum } from './statuses/statuses.enum';
import { FileType } from '@storage/files/domain/file';
import { ImageProcessingService } from '@storage/files/infrastructure/image-processing/image-processing.service';
import { FileUploadDto } from '@storage/files/dto/file-upload.dto';
import { Inject } from '@nestjs/common';
import { Role } from '@iam/roles/domain/role';
import { Status } from './statuses/domain/status';
import { UpdateUserDto } from '@users/dto/update-user.dto';
import { infinityPagination } from '@infra/utils/infinity-pagination';
import { FindAllUserPaginatedDto } from '@users/dto/find-all-user-paginated.dto';
import { InfinityPaginationResponseDto } from '@infra/utils/dto/infinity-pagination-response.dto';
import { FindAllUserDto } from '@users/dto/find-all-user.dto';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '@src/config/config.type';

const ROLE_IDS = new Set(Object.values(RoleEnum).map(String));
const STATUS_IDS = new Set(Object.values(StatusEnum).map(String));

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UserRepository,
    private readonly filesService: FilesService,
    private readonly configService: ConfigService<AllConfigType>,
    @Inject('FILE_UPLOADER_SERVICE')
    private readonly fileUploaderService: any, // Can be FilesLocalService or FilesS3Service
    private readonly imageProcessingService: ImageProcessingService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Do not remove comment below.
    // <creating-property />

    let password: string | undefined = undefined;

    if (createUserDto.password) {
      const salt = await bcrypt.genSalt();
      password = await bcrypt.hash(createUserDto.password, salt);
    }

    let email: string | null = null;

    if (createUserDto.email) {
      const userObject = await this.usersRepository.findByEmail(
        createUserDto.email,
      );
      if (userObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailAlreadyExists',
          },
        });
      }
      email = createUserDto.email;
    }

    let role: Role | undefined = undefined;

    if (createUserDto.role?.id) {
      const roleObject = ROLE_IDS.has(String(createUserDto.role.id));
      if (!roleObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            role: 'roleNotExists',
          },
        });
      }

      role = {
        id: createUserDto.role.id,
      };
    }

    let status: Status | undefined = undefined;

    if (createUserDto.status?.id) {
      const statusObject = STATUS_IDS.has(String(createUserDto.status.id));
      if (!statusObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            status: 'statusNotExists',
          },
        });
      }

      status = {
        id: createUserDto.status.id,
      };
    }

    return this.usersRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      email: email,
      password: password,
      role: role,
      status: status,
      provider: createUserDto.provider ?? AuthProvidersEnum.email,
      socialId: createUserDto.socialId,
      language: createUserDto.language ?? null,
    });
  }

  findAll(query: FindAllUserDto): Promise<User[]> {
    return this.usersRepository.findAll({ filters: query.filter });
  }

  countAll(filters?: Record<string, any>): Promise<number> {
    return this.usersRepository.countAll(filters);
  }

  async findAllWithPagination(
    query: FindAllUserPaginatedDto,
  ): Promise<InfinityPaginationResponseDto<User>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 100) {
      limit = 100;
    }

    // Extract filters from the query if they exist
    const filters = query.filter || {};

    // Get the data with pagination and filters
    const Paginations = await this.usersRepository.findAllWithPagination({
      paginationOptions: {
        page,
        limit,
      },
      filters,
    });

    // Count total records with the same filters
    const totalCount = await this.countAll(filters);

    const backendDomain = this.configService.getOrThrow('app.backendDomain', {
      infer: true,
    });
    const baseUrl = `${backendDomain}${query.originalUrl}`;

    return infinityPagination(
      Paginations,
      { page, limit },
      totalCount,
      filters,
      baseUrl,
    );
  }

  async findById(id: User['id']): Promise<NullableType<User>> {
    const user = await this.usersRepository.findById(id);
    return this.resolvePhoto(user);
  }

  async updateProfilePhoto(
    userId: User['id'],
    file: Express.Multer.File,
  ): Promise<User> {
    if (!this.imageProcessingService.isImage(file.mimetype)) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          file: 'onlyImageAllowed',
        },
      });
    }

    // Find existing profile photo
    const { data: photos } = await this.filesService.findWithFilters({
      entityName: 'user',
      entityId: String(userId),
      context: 'profile',
    });

    // Delete existing photos if any
    for (const photo of photos) {
      await this.filesService.delete(photo.id);
    }

    // Upload new photo
    const uploadDto: FileUploadDto = {
      isPublic: true,
      entityName: 'user',
      entityId: String(userId),
      context: 'profile',
    };

    await this.fileUploaderService.create(file, uploadDto, userId);

    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  findByIds(ids: User['id'][]): Promise<User[]> {
    return this.usersRepository.findByIds(ids);
  }

  async findByEmail(email: User['email']): Promise<NullableType<User>> {
    const user = await this.usersRepository.findByEmail(email);
    return this.resolvePhoto(user);
  }

  async findBySocialIdAndProvider({
    socialId,
    provider,
  }: {
    socialId: User['socialId'];
    provider: User['provider'];
  }): Promise<NullableType<User>> {
    const user = await this.usersRepository.findBySocialIdAndProvider({
      socialId,
      provider,
    });
    return this.resolvePhoto(user);
  }

  private async resolvePhoto(
    user: NullableType<User>,
  ): Promise<NullableType<User>> {
    if (!user) return null;

    // Resolve profile photo polymorphically via the file storage system
    const { data: photos } = await this.filesService.findWithFilters({
      entityName: 'user',
      entityId: String(user.id),
      context: 'profile',
    });
    user.photo = photos[0] ?? null;

    return user;
  }

  async update(
    id: User['id'],
    updateUserDto: UpdateUserDto,
  ): Promise<User | null> {
    // Do not remove comment below.
    // <updating-property />

    let password: string | undefined = undefined;

    if (updateUserDto.password) {
      const userObject = await this.usersRepository.findById(id);

      if (userObject && userObject?.password !== updateUserDto.password) {
        const salt = await bcrypt.genSalt();
        password = await bcrypt.hash(updateUserDto.password, salt);
      }
    }

    let email: string | null | undefined = undefined;

    if (updateUserDto.email) {
      const userObject = await this.usersRepository.findByEmail(
        updateUserDto.email,
      );

      if (userObject && userObject.id !== id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailAlreadyExists',
          },
        });
      }

      email = updateUserDto.email;
    } else if (updateUserDto.email === null) {
      email = null;
    }

    let role: Role | undefined = undefined;

    if (updateUserDto.role?.id) {
      const roleObject = ROLE_IDS.has(String(updateUserDto.role.id));
      if (!roleObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            role: 'roleNotExists',
          },
        });
      }

      role = {
        id: updateUserDto.role.id,
      };
    }

    let status: Status | undefined = undefined;

    if (updateUserDto.status?.id) {
      const statusObject = STATUS_IDS.has(String(updateUserDto.status.id));
      if (!statusObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            status: 'statusNotExists',
          },
        });
      }

      status = {
        id: updateUserDto.status.id,
      };
    }

    return this.usersRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      firstName: updateUserDto.firstName,
      lastName: updateUserDto.lastName,
      email,
      password,
      role,
      status,
      provider: updateUserDto.provider,
      socialId: updateUserDto.socialId,
    });
  }

  async remove(id: User['id']): Promise<void> {
    await this.usersRepository.remove(id);
  }
}
