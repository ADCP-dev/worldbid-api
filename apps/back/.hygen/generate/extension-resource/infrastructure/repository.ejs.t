---
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.repository.ts
---
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { <%= name %>Entity } from './entities/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.entity';
import { NullableType } from '@infra/utils/types/nullable.type';
import { <%= name %> } from '../domain/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>';
import { <%= name %>Mapper } from './mappers/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.mapper';
import { IPaginationOptions } from '@infra/utils/types/pagination-options';
import { buildWhereClause } from '@infra/utils/parse-filter';
import { Create<%= name %>Dto } from '../dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto';
import { Update<%= name %>Dto } from '../dto/update-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto';

@Injectable()
export class <%= name %>Repository {
  constructor(
    @InjectRepository(<%= name %>Entity)
    private readonly <%= h.inflection.camelize(name, true) %>Repository: Repository<<%= name %>Entity>,
  ) {}

  async create(data: Create<%= name %>Dto): Promise<<%= name %>> {
    const persistenceModel = <%= name %>Mapper.toPersistenceForCreate(data);
    const newEntity = await this.<%= h.inflection.camelize(name, true) %>Repository.save(persistenceModel);
    return <%= name %>Mapper.toDomain(newEntity);
  }

  async update(id: <%= name %>['id'], data: Update<%= name %>Dto): Promise<<%= name %>> {
    const persistenceModel = <%= name %>Mapper.toPersistenceForUpdate(data);
    const entity = await this.<%= h.inflection.camelize(name, true) %>Repository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.<%= h.inflection.camelize(name, true) %>Repository.save({
      ...entity,
      ...persistenceModel,
    });

    return <%= name %>Mapper.toDomain(updatedEntity);
  }

  async findAllWithPagination({
    paginationOptions,
    filters,
  }: {
    paginationOptions: IPaginationOptions;
    filters?: Record<string, any>;
  }): Promise<<%= name %>[]> {
    const queryOptions: any = {
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    };
    if (filters && Object.keys(filters).length > 0) {
      queryOptions.where = buildWhereClause(filters);
    }

    const entities = await this.<%= h.inflection.camelize(name, true) %>Repository.find(queryOptions);

    return entities.map((entity) => <%= name %>Mapper.toDomain(entity));
  }

  async findAll({
    filters = {},
  }: {
    filters?: Record<string, any>;
  }): Promise<<%= name %>[]> {
    const entities = await this.<%= h.inflection.camelize(name, true) %>Repository.find({
      where: buildWhereClause(filters),
    });

    return entities.map((entity) => <%= name %>Mapper.toDomain(entity));
  }

  async findById(id: <%= name %>['id']): Promise<NullableType<<%= name %>>> {
    const entity = await this.<%= h.inflection.camelize(name, true) %>Repository.findOne({
      where: { id },
    });

    return entity ? <%= name %>Mapper.toDomain(entity) : null;
  }

  async findByIds(ids: <%= name %>['id'][]): Promise<<%= name %>[]> {
    const entities = await this.<%= h.inflection.camelize(name, true) %>Repository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => <%= name %>Mapper.toDomain(entity));
  }

  async remove(id: <%= name %>['id']): Promise<void> {
    await this.<%= h.inflection.camelize(name, true) %>Repository.delete(id);
  }

  async countAll(filters?: Record<string, any>): Promise<number> {
    return this.<%= h.inflection.camelize(name, true) %>Repository.count({
      where: filters ? buildWhereClause(filters) : {},
    });
  }
}
