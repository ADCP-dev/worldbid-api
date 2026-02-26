---
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>.service.ts
---
import {
  // common
  Injectable,
} from '@nestjs/common';
import { Create<%= name %>Dto } from './dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto';
import { Update<%= name %>Dto } from './dto/update-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto';
import { <%= name %>Repository } from './infrastructure/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.repository';
import { <%= name %> } from './domain/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>';
import { infinityPagination } from '@infra/utils/infinity-pagination';
import { InfinityPaginationResponseDto } from '@infra/utils/dto/infinity-pagination-response.dto';
import { FindAll<%= h.inflection.transform(name, ['pluralize']) %>Dto } from './dto/find-all-<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>.dto';
import { FindAll<%= h.inflection.transform(name, ['pluralize']) %>PaginatedDto } from './dto/find-all-<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>-paginated.dto';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '@src/config/config.type';

@Injectable()
export class <%= h.inflection.transform(name, ['pluralize']) %>Service {
  constructor(
    // Dependencies here
    private readonly <%= h.inflection.camelize(name, true) %>Repository: <%= name %>Repository,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async create(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    create<%= name %>Dto: Create<%= name %>Dto
  ) {
    return this.<%= h.inflection.camelize(name, true) %>Repository.create(create<%= name %>Dto);
  }

  findById(id: <%= name %>['id']) {
    return this.<%= h.inflection.camelize(name, true) %>Repository.findById(id);
  }

  findByIds(ids: <%= name %>['id'][]) {
    return this.<%= h.inflection.camelize(name, true) %>Repository.findByIds(ids);
  }

  countAll(filters: Record<string, any>): Promise<number> {
    return this.<%= h.inflection.camelize(name, true) %>Repository.countAll(filters);
  }

  findAll(query: FindAll<%= h.inflection.transform(name, ['pluralize']) %>Dto): Promise<<%= name %>[]> {
    return this.<%= h.inflection.camelize(name, true) %>Repository.findAll({ filters: query.filter });
  }

  async findAllWithPagination(
    query: FindAll<%= h.inflection.transform(name, ['pluralize']) %>PaginatedDto,
  ): Promise<InfinityPaginationResponseDto<<%= name %>>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 100) {
      limit = 100;
    }

    // Extract filters from the query if they exist
    const filters = query.filter || {};

    // Get the data with pagination and filters
    const <%= h.inflection.transform(name, ['pluralize']) %> = await this.<%= h.inflection.camelize(name, true) %>Repository.findAllWithPagination({
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

    return infinityPagination(<%= h.inflection.transform(name, ['pluralize']) %>, { page, limit }, totalCount, filters, baseUrl);
  }

  async update(
    id: <%= name %>['id'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update<%= name %>Dto: Update<%= name %>Dto,
  ) {
    return this.<%= h.inflection.camelize(name, true) %>Repository.update(id, update<%= name %>Dto);
  }

  remove(id: <%= name %>['id']) {
    return this.<%= h.inflection.camelize(name, true) %>Repository.remove(id);
  }
}
