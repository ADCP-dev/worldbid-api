---
inject: true
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
before: "} from 'class-validator'"
skip_if: \IsEnum,
---
<% if (isAddToDto && type === 'enum') { -%>
  IsEnum,
<% } -%>
