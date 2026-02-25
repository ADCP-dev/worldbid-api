---
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/extension.module.ts
---
import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { <%= h.inflection.transform(name, ['pluralize']) %>Service } from './<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>.service';
import { <%= h.inflection.transform(name, ['pluralize']) %>Controller } from './<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>.controller';
import { <%= name %>PersistenceModule } from './infrastructure/persistence.module';

@Module({
  imports: [
    // do not remove this comment
    <%= name %>PersistenceModule,
  ],
  controllers: [<%= h.inflection.transform(name, ['pluralize']) %>Controller],
  providers: [<%= h.inflection.transform(name, ['pluralize']) %>Service],
  exports: [<%= h.inflection.transform(name, ['pluralize']) %>Service, <%= name %>PersistenceModule],
})
export class <%= h.inflection.transform(name, ['pluralize']) %>ExtensionModule {}
