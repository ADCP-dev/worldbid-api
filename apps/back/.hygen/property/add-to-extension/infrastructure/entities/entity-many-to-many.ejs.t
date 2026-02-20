---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/entities/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.entity.ts
before: from \'typeorm\'
skip_if: \ManyToMany,
---
<% if (kind === 'reference' && referenceType === 'manyToMany') { -%>
  ManyToMany,
<% } -%>