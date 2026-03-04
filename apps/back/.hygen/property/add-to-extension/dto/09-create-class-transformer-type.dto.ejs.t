---
inject: true
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
before: "} from 'class-transformer'"
skip_if: \Type,
---
<% if (isAddToDto && kind === 'primitive' && (type === 'Date' || type === 'timestamp')) { -%>
  Type,
<% } -%>
<% if (isAddToDto && kind === 'primitive' && (type === 'json' || type === 'jsonb')) { -%>
  Type,
<% } -%>