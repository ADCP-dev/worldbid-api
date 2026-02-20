---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
before: "} from 'class-transformer'"
skip_if: \Type,
---
<% if (isAddToDto && (kind === 'reference' || kind === 'duplication')) { -%>
  Type,
<% } -%>