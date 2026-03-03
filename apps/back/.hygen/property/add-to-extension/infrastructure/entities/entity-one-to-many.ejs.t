---
inject: true
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/entities/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.entity.ts
before: from \'typeorm\'
skip_if: \sOneToMany,
---
<% if (kind === 'reference' && referenceType === 'oneToMany') { -%>
  OneToMany,
<% } -%>