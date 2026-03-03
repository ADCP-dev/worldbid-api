---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/mappers/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.mapper.ts
after: // <mapping-properties />
---
<% if (kind === 'primitive') { -%>
  persistenceEntity.<%= property %> = dto.<%= property %>;
<% } -%>
