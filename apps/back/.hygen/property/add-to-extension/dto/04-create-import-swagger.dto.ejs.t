---
inject: true
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
before: export class Create<%= name %>Dto
skip_if: "} from '@nestjs/swagger'"
---
<% if (isAddToDto) { -%>
import {
} from '@nestjs/swagger';
<% } -%>
