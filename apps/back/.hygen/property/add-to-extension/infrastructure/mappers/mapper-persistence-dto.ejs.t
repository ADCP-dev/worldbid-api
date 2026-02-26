---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/mappers/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.mapper.ts
after: // <mapping-properties />
---
<% if (kind === 'primitive') { -%>
  persistenceEntity.<%= property %> = dto.<%= property %>;
<% } else if (kind === 'reference' || kind === 'duplication') { -%>
  <% if (referenceType === 'oneToOne' || referenceType === 'manyToOne') { -%>
    if (dto.<%= property %>) {
      persistenceEntity.<%= property %> = <%= type %>Mapper.toDomain(dto.<%= property %>);
    }
    <% if (isNullable) { -%>
      else if (dto.<%= property %> === null) {
        persistenceEntity.<%= property %> = null;
      }
    <% } -%>
  <% } else if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>
    if (dto.<%= property %>) {
      persistenceEntity.<%= property %> = dto.<%= property %>.map((item) => <%= type %>Mapper.toDomain(item));
    }
    <% if (isNullable) { -%>
      else if (dto.<%= property %> === null) {
        persistenceEntity.<%= property %> = null;
      }
    <% } -%>
  <% } -%>
<% } -%>
