---
inject: true
to: src/custom/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/entities/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.entity.ts
before: from \'typeorm\'
skip_if: \sOneToOne,
---
<% if (kind === 'reference' && referenceType === 'oneToOne') { -%>
  OneToOne,
<% } -%>