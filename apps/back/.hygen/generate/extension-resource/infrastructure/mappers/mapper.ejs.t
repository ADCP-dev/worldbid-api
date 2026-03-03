---
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/mappers/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.mapper.ts
---
import { <%= name %> } from '../../domain/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>';
import { <%= name %>Entity } from '../entities/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.entity';
import { Create<%= name %>Dto } from '../../dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto';

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
  static toPersistenceForCreate(data: Create<%= name %>Dto): <%= name %>Entity {
    const persistenceEntity = new <%= name %>Entity();
    // <mapping-properties />
    return persistenceEntity;
  }

  /**
   * Maps a Partial<<%= name %>> to a <%= name %>Entity for database update.
   */
  static toPersistenceForUpdate(data: Partial<<%= name %>>): <%= name %>Entity {
    const persistenceEntity = new <%= name %>Entity();
    // <mapping-properties />
    // Handle id for updates
    if (data.id) {
      persistenceEntity.id = data.id;
    }
    return persistenceEntity;
  }
}
