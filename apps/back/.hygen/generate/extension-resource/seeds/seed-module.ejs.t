---
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/seeds/seed.module.ts
---
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { <%= name %>Entity } from '../infrastructure/entities/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.entity';
import { <%= name %>SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([<%= name %>Entity])],
  providers: [<%= name %>SeedService],
  exports: [<%= name %>SeedService],
})
export class <%= name %>SeedModule {}
