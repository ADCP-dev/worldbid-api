import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TestExtensionEntity } from './entities/test-extension.entity';
import { NullableType } from '../../../utils/types/nullable.type';
import { TestExtension } from '../domain/test-extension';
import { TestExtensionMapper } from './mappers/test-extension.mapper';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { buildWhereClause } from '../../../utils/parse-filter';

@Injectable()
export class TestExtensionRepository {
  constructor(
    @InjectRepository(TestExtensionEntity)
    private readonly testExtensionRepository: Repository<TestExtensionEntity>,
  ) {}

  async create(data: Omit<TestExtension, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<TestExtension> {
    const persistenceModel = TestExtensionMapper.toPersistence(data as TestExtension);
    const newEntity = await this.testExtensionRepository.save(
      this.testExtensionRepository.create(persistenceModel),
    );
    return TestExtensionMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
    filters,
  }: {
    paginationOptions: IPaginationOptions;
    filters?: Record<string, any>;
  }): Promise<TestExtension[]> {
    const queryOptions: any = {
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    };
    if (filters && Object.keys(filters).length > 0) {
      queryOptions.where = buildWhereClause(filters);
    }

    const entities = await this.testExtensionRepository.find(queryOptions);

    return entities.map((entity) => TestExtensionMapper.toDomain(entity));
  }

  async findAll({
    filters = {},
  }: {
    filters?: Record<string, any>;
  }): Promise<TestExtension[]> {
    const entities = await this.testExtensionRepository.find({
      where: buildWhereClause(filters),
    });

    return entities.map((entity) => TestExtensionMapper.toDomain(entity));
  }

  async findById(id: TestExtension['id']): Promise<NullableType<TestExtension>> {
    const entity = await this.testExtensionRepository.findOne({
      where: { id },
    });

    return entity ? TestExtensionMapper.toDomain(entity) : null;
  }

  async findByIds(ids: TestExtension['id'][]): Promise<TestExtension[]> {
    const entities = await this.testExtensionRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => TestExtensionMapper.toDomain(entity));
  }

  async update(
    id: TestExtension['id'],
    payload: Partial<TestExtension>,
  ): Promise<TestExtension> {
    const entity = await this.testExtensionRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.testExtensionRepository.save(
      this.testExtensionRepository.create(
        TestExtensionMapper.toPersistence({
          ...TestExtensionMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return TestExtensionMapper.toDomain(updatedEntity);
  }

  async remove(id: TestExtension['id']): Promise<void> {
    await this.testExtensionRepository.delete(id);
  }

  async countAll(filters?: Record<string, any>): Promise<number> {
    return this.testExtensionRepository.count({
      where: filters ? buildWhereClause(filters) : {},
    });
  }
}
