---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
before: "} from 'class-validator'"
skip_if: \IsNotEmptyObject,
---
<% if (isAddToDto && ((kind === 'reference' || kind === 'duplication') && (referenceType === 'oneToOne' || referenceType === 'manyToOne'))) { -%>
  IsNotEmptyObject,
<% } -%>