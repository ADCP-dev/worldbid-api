---
inject: true
to: src/custom/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
before: "} from 'class-validator'"
skip_if: \ValidateNested,
---
<% if (isAddToDto && kind === 'primitive' && (type === 'json' || type === 'jsonb')) { -%>
  ValidateNested,
<% } -%>