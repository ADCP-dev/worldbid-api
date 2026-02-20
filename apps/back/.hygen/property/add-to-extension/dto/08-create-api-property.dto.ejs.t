---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
before: "} from '@nestjs/swagger'"
skip_if: \ApiProperty,
---
<% if (isAddToDto) { -%>
  ApiProperty,
<% } -%>