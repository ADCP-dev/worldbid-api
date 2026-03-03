---
to: src/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/mappers/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.mapper.ts
---
import { <%= name %> } from '../../domain/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>';
import { <%= name %>Entity } from '../entities/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.entity';
import { Create<%= name %>Dto } from '../../dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto';
import { Update<%= name %>Dto } from '../../dto/update-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto';

export class <%= name %>Mapper {
  static toDomain(raw: <%= name %>Entity): <%= name %> {
    const domainEntity = new <%= name %>();
    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  /**
   * Maps a Create<%= name %>Dto to a <%= name %>Entity for database creation.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static toPersistenceForCreate(data: Create<%= name %>Dto): <%= name %>Entity {
    const persistenceEntity = new <%= name %>Entity();
    // <mapping-properties />
    return persistenceEntity;
  }

  /**
   * Maps a Update<%= name %>Dto to a <%= name %>Entity for database update.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static toPersistenceForUpdate(data: Update<%= name %>Dto): <%= name %>Entity {
    const persistenceEntity = new <%= name %>Entity();
    // <mapping-properties-update />
    return persistenceEntity;
  }
}
