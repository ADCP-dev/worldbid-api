import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository, In } from 'typeorm';
import { UserEntity } from '@users/infrastructure/entities/user.entity';
import { NullableType } from '@infra/utils/types/nullable.type';
import { User } from '@users/domain/user';
import { UserMapper } from '@users/infrastructure/mappers/user.mapper';
import { IPaginationOptions } from '@infra/utils/types/pagination-options';
import { buildWhereClause } from '@infra/utils/parse-filter';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async create(
    data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<User> {
    const persistenceModel = UserMapper.toPersistence(data as User);
    const newEntity = await this.usersRepository.save(
      this.usersRepository.create(persistenceModel),
    );
    return UserMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
    filters,
  }: {
    paginationOptions: IPaginationOptions;
    filters?: Record<string, any>;
  }): Promise<User[]> {
    // Build query options with pagination
    const queryOptions: any = {
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    };
    // Add WHERE conditions if filters are provided
    if (filters && Object.keys(filters).length > 0) {
      queryOptions.where = buildWhereClause(filters);
    }

    const entities = await this.usersRepository.find(queryOptions);

    return entities.map((entity) => UserMapper.toDomain(entity));
  }

  async findAll({
    filters = {},
  }: {
    filters?: Record<string, any>;
  }): Promise<User[]> {
    const entities = await this.usersRepository.find({
      where: buildWhereClause(filters),
    });

    return entities.map((entity) => UserMapper.toDomain(entity));
  }

  async findById(id: User['id']): Promise<NullableType<User>> {
    const entity = await this.usersRepository.findOne({
      where: { id: Number(id) },
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByIds(ids: User['id'][]): Promise<User[]> {
    const entities = await this.usersRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((user) => UserMapper.toDomain(user));
  }

  async findByEmail(email: User['email']): Promise<NullableType<User>> {
    if (!email) return null;

    const entity = await this.usersRepository.findOne({
      where: { email },
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findBySocialIdAndProvider({
    socialId,
    provider,
  }: {
    socialId: User['socialId'];
    provider: User['provider'];
  }): Promise<NullableType<User>> {
    if (!socialId || !provider) return null;

    const entity = await this.usersRepository.findOne({
      where: { socialId, provider },
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async update(id: User['id'], payload: Partial<User>): Promise<User> {
    const entity = await this.usersRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('User not found');
    }

    const updatedEntity = await this.usersRepository.save(
      this.usersRepository.create(
        UserMapper.toPersistence({
          ...UserMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return UserMapper.toDomain(updatedEntity);
  }

  async remove(id: User['id']): Promise<void> {
    await this.usersRepository.softDelete(id);
  }

  async countAll(filters?: Record<string, any>): Promise<number> {
    return this.usersRepository.count({
      where: filters ? buildWhereClause(filters) : {},
    });
  }
}
