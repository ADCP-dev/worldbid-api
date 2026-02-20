---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
before: export class Create<%= name %>Dto
skip_if: "} from 'class-validator'"
---
<% if (isAddToDto) { -%>
  import {
    // decorators here
  } from 'class-validator';
<% } -%>