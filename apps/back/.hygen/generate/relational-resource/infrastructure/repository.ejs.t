---
to: src/<%= destination %>/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.repository.ts
---
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { plainToClass } from 'class-transformer';
import { <%= name %>Entity } from './entities/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.entity';
import { NullableType } from '@infra/utils/types/nullable.type';
import { <%= name %> } from '../domain/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>';
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
    const entity = plainToClass(<%= name %>Entity, data);
    const newEntity = await this.<%= h.inflection.camelize(name, true) %>Repository.save(entity);
    return plainToClass(<%= name %>, newEntity);
  }

  async update(id: <%= name %>['id'], data: Update<%= name %>Dto): Promise<<%= name %>> {
    const entity = await this.<%= h.inflection.camelize(name, true) %>Repository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    Object.assign(entity, data);
    const updatedEntity = await this.<%= h.inflection.camelize(name, true) %>Repository.save(entity);

    return plainToClass(<%= name %>, updatedEntity);
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

    return entities.map((entity) => plainToClass(<%= name %>, entity));
  }

  async findAll({
    filters = {},
  }: {
    filters?: Record<string, any>;
  }): Promise<<%= name %>[]> {
    const entities = await this.<%= h.inflection.camelize(name, true) %>Repository.find({
      where: buildWhereClause(filters),
    });

    return entities.map((entity) => plainToClass(<%= name %>, entity));
  }

  async findById(id: <%= name %>['id']): Promise<NullableType<<%= name %>>> {
    const entity = await this.<%= h.inflection.camelize(name, true) %>Repository.findOne({
      where: { id },
    });

    return entity ? plainToClass(<%= name %>, entity) : null;
  }

  async findByIds(ids: <%= name %>['id'][]): Promise<<%= name %>[]> {
    const entities = await this.<%= h.inflection.camelize(name, true) %>Repository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => plainToClass(<%= name %>, entity));
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
