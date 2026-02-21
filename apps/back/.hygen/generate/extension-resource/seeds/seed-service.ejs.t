---
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/seeds/seed.service.ts
---
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { <%= name %>Entity } from '../infrastructure/entities/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.entity';

@Injectable()
export class <%= name %>SeedService {
  private readonly logger = new Logger(<%= name %>SeedService.name);

  constructor(
    @InjectRepository(<%= name %>Entity)
    private readonly repository: Repository<<%= name %>Entity>,
  ) {}

  async run(): Promise<void> {
    const count = await this.repository.count();

    if (count > 0) {
      this.logger.log('<%= name %> seed data already exists — skipping');
      return;
    }

    // Add your seed data here
    // await this.repository.save(
    //   this.repository.create({ ... }),
    // );

    this.logger.log('<%= name %> seed data created');
  }
}
